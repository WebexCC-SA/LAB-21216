(() => {
    "use strict";

    const PEOPLE_URL =
        "https://webexapis.com/v1/people?callingData=true&max=100";
    const ACTIVATION_URL =
        "https://webexapis.com/v1/devices/activationCode";
    const DEVICEFX_URL = "https://nfc.devicefx.com/onboarding";
    const LOCAL_EDITOR_API = "http://127.0.0.1:8765";
    const REQUEST_TIMEOUT_MS = 15000;
    const ALLOWED_MODELS = new Set([
        "Cisco 9871",
        "Cisco 9861"
    ]);
    let activeRequestController = null;
    let localEditorToken = "";

    function getElements(app) {
        const byId = (id) => {
            const element = app.querySelector(`#${id}`);
            if (!element) {
                throw new Error(`DeviceFX form element is missing: ${id}`);
            }
            return element;
        };
        return {
            token: byId("devicefx-token"),
            toggleToken: byId("devicefx-toggle-token"),
            loadUsers: byId("devicefx-load-users"),
            person: byId("devicefx-person"),
            model: byId("devicefx-model"),
            generate: byId("devicefx-generate-code"),
            status: byId("devicefx-status"),
            result: byId("devicefx-result"),
            activationCode: byId("devicefx-activation-code"),
            onboardingUrl: byId("devicefx-onboarding-url"),
            qrCode: byId("devicefx-qr-code"),
            expiry: byId("devicefx-expiry"),
            copyCode: byId("devicefx-copy-code"),
            copyUrl: byId("devicefx-copy-url")
        };
    }

    function bearerToken(input) {
        return input.value.trim().replace(/^Bearer\s+/i, "");
    }

    function setStatus(elements, message, isError = false) {
        elements.status.textContent = message;
        elements.status.classList.toggle("devicefx-status-error", isError);
    }

    function resetResult(elements) {
        elements.result.hidden = true;
        elements.activationCode.textContent = "";
        elements.onboardingUrl.textContent = "";
        elements.onboardingUrl.removeAttribute("href");
        elements.qrCode.replaceChildren();
        elements.expiry.textContent = "";
    }

    function resetPeople(elements) {
        elements.person.replaceChildren();
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Load calling users first";
        elements.person.append(option);
        elements.person.disabled = true;
        elements.generate.disabled = true;
    }

    async function apiRequest(url, options) {
        activeRequestController?.abort();
        const controller = new AbortController();
        activeRequestController = controller;
        const timeout = window.setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS
        );
        try {
            return await fetch(url, {
                ...options,
                mode: "cors",
                cache: "no-store",
                credentials: "omit",
                redirect: "error",
                signal: controller.signal
            });
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(
                    "The Webex request timed out. Verify the token and try again."
                );
            }
            throw new Error(
                "The Webex API could not be reached. Check the network and try again."
            );
        } finally {
            window.clearTimeout(timeout);
            if (activeRequestController === controller) {
                activeRequestController = null;
            }
        }
    }

    async function responseData(response) {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
            throw new Error("Webex returned an unexpected response format.");
        }
        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error("Webex returned invalid JSON.");
        }
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error(
                    "The bearer token is invalid or expired. Copy a new token and try again."
                );
            }
            if (response.status === 403) {
                throw new Error(
                    "The token does not have the required Webex administrator scopes."
                );
            }
            if (response.status === 429) {
                throw new Error(
                    "Webex is temporarily rate limiting requests. Wait and try again."
                );
            }
            if (
                response.status === 502 &&
                typeof data.error === "string"
            ) {
                throw new Error(data.error);
            }
            throw new Error(
                `Webex rejected the request (HTTP ${response.status}).`
            );
        }
        return data;
    }

    function isLocalPreview() {
        return (
            window.location.hostname === "127.0.0.1" ||
            window.location.hostname === "localhost"
        );
    }

    async function getLocalEditorToken() {
        if (localEditorToken) {
            return localEditorToken;
        }
        let response;
        try {
            response = await apiRequest(`${LOCAL_EDITOR_API}/config`, {
                method: "GET",
                headers: { Accept: "application/json" }
            });
        } catch {
            throw new Error(
                "Local preview requires the Lab editor service. Run python scripts/image_size_editor.py --no-mkdocs and try again."
            );
        }
        if (!response.ok) {
            throw new Error(
                "The local Lab editor service could not be authorized."
            );
        }
        const config = await response.json();
        if (!config || typeof config.token !== "string") {
            throw new Error(
                "The local Lab editor service returned invalid configuration."
            );
        }
        localEditorToken = config.token;
        return localEditorToken;
    }

    async function webexRequest(operation, token, requestData = {}) {
        if (!isLocalPreview()) {
            if (operation === "people") {
                return apiRequest(PEOPLE_URL, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`
                    }
                });
            }
            return apiRequest(ACTIVATION_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            });
        }

        const editorToken = await getLocalEditorToken();
        return apiRequest(`${LOCAL_EDITOR_API}/webex-proxy/${operation}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Image-Editor-Token": editorToken
            },
            body: JSON.stringify({
                bearer_token: token,
                person_id: requestData.personId,
                model: requestData.model
            })
        });
    }

    function callingPeople(items) {
        if (!Array.isArray(items)) {
            throw new Error("Webex returned an invalid people list.");
        }
        const people = items
            .filter(
                (person) =>
                    person &&
                    typeof person.id === "string" &&
                    person.id.length > 0 &&
                    typeof person.displayName === "string" &&
                    person.displayName.trim().length > 0
            )
            .filter(
                (person) =>
                    typeof person.locationId === "string" ||
                    typeof person.extension === "string" ||
                    (
                        Array.isArray(person.phoneNumbers) &&
                        person.phoneNumbers.length > 0
                    )
            )
            .map((person) => ({
                id: person.id,
                displayName: person.displayName.trim(),
                email: (
                    Array.isArray(person.emails) &&
                    typeof person.emails[0] === "string"
                ) ? person.emails[0] : ""
            }));
        people.sort((first, second) =>
            first.displayName.localeCompare(second.displayName)
        );
        return people;
    }

    function populatePeople(elements, people) {
        elements.person.replaceChildren();
        people.forEach((person) => {
            const option = document.createElement("option");
            option.value = person.id;
            option.textContent = person.email
                ? `${person.displayName} (${person.email})`
                : person.displayName;
            option.dataset.displayName = person.displayName;
            elements.person.append(option);
        });
        const charles = [...elements.person.options].find(
            (option) =>
                option.dataset.displayName.toLowerCase() === "charles holland"
        );
        if (charles) {
            elements.person.value = charles.value;
        }
        elements.person.disabled = false;
        elements.generate.disabled = false;
    }

    function formatActivationCode(value) {
        if (typeof value !== "string") {
            throw new Error("Webex did not return an activation code.");
        }
        const trimmed = value.trim();
        if (
            !/^\d{16}$/.test(trimmed) &&
            !/^\d{4}(?:-\d{4}){3}$/.test(trimmed)
        ) {
            throw new Error("Webex returned an invalid activation code.");
        }
        return trimmed.replaceAll("-", "").match(/\d{4}/g).join("-");
    }

    function buildOnboardingUrl(code) {
        const onboardingUrl = new URL(DEVICEFX_URL);
        onboardingUrl.searchParams.set("activation-code", code);
        return onboardingUrl.href;
    }

    function renderQrCode(container, value) {
        if (typeof window.qrcode !== "function") {
            throw new Error("The local QR code generator is unavailable.");
        }
        const qr = window.qrcode(0, "M");
        qr.addData(value);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const quietZone = 4;
        const cellSize = Math.max(
            4,
            Math.floor(256 / (moduleCount + quietZone * 2))
        );
        const size = (moduleCount + quietZone * 2) * cellSize;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.setAttribute("aria-hidden", "true");
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("This browser cannot render the QR code.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.fillStyle = "#000000";
        for (let row = 0; row < moduleCount; row += 1) {
            for (let column = 0; column < moduleCount; column += 1) {
                if (qr.isDark(row, column)) {
                    context.fillRect(
                        (column + quietZone) * cellSize,
                        (row + quietZone) * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
        container.replaceChildren(canvas);
    }

    async function copyText(value, elements, label) {
        try {
            await navigator.clipboard.writeText(value);
            setStatus(elements, `${label} copied.`);
        } catch {
            setStatus(
                elements,
                `${label} could not be copied. Select and copy it manually.`,
                true
            );
        }
    }

    function initializeDeviceFxApp() {
        activeRequestController?.abort();
        const app = document.querySelector("#devicefx-activation-app");
        if (!app || app.dataset.initialized === "true") {
            return;
        }

        let elements;
        try {
            elements = getElements(app);
        } catch (error) {
            console.error(error.message);
            return;
        }
        app.dataset.initialized = "true";
        let loadedToken = "";

        elements.toggleToken.addEventListener("click", () => {
            const showing = elements.token.type === "text";
            elements.token.type = showing ? "password" : "text";
            elements.toggleToken.textContent = showing ? "Show" : "Hide";
            elements.toggleToken.setAttribute(
                "aria-pressed",
                String(!showing)
            );
            elements.token.focus();
        });

        elements.token.addEventListener("input", () => {
            if (bearerToken(elements.token) !== loadedToken) {
                resetPeople(elements);
                resetResult(elements);
                setStatus(elements, "");
            }
        });

        elements.loadUsers.addEventListener("click", async () => {
            const token = bearerToken(elements.token);
            if (!token) {
                setStatus(elements, "Paste a Webex bearer token first.", true);
                elements.token.focus();
                return;
            }
            resetPeople(elements);
            resetResult(elements);
            elements.loadUsers.disabled = true;
            setStatus(elements, "Loading calling users…");
            try {
                const response = await webexRequest("people", token);
                const data = await responseData(response);
                const people = callingPeople(data.items);
                if (!people.length) {
                    throw new Error(
                        "No Webex Calling users were found for this organization."
                    );
                }
                loadedToken = token;
                populatePeople(elements, people);
                setStatus(
                    elements,
                    `Loaded ${people.length} calling user${people.length === 1 ? "" : "s"}.`
                );
            } catch (error) {
                loadedToken = "";
                setStatus(elements, error.message, true);
            } finally {
                elements.loadUsers.disabled = false;
            }
        });

        elements.generate.addEventListener("click", async () => {
            const token = bearerToken(elements.token);
            const personId = elements.person.value;
            const model = elements.model.value;
            if (!token || token !== loadedToken) {
                setStatus(
                    elements,
                    "Reload the calling users with the current bearer token.",
                    true
                );
                return;
            }
            if (!personId) {
                setStatus(elements, "Select a calling user.", true);
                return;
            }
            if (!ALLOWED_MODELS.has(model)) {
                setStatus(elements, "Select a supported phone model.", true);
                return;
            }

            resetResult(elements);
            elements.generate.disabled = true;
            setStatus(elements, "Generating the activation code…");
            try {
                const response = await webexRequest(
                    "activation",
                    token,
                    { personId, model }
                );
                const data = await responseData(response);
                const code = formatActivationCode(data.code);
                const url = buildOnboardingUrl(code);

                elements.activationCode.textContent = code;
                elements.onboardingUrl.href = url;
                elements.onboardingUrl.textContent = url;
                renderQrCode(elements.qrCode, url);
                if (
                    typeof data.expiryTime === "string" &&
                    !Number.isNaN(Date.parse(data.expiryTime))
                ) {
                    elements.expiry.textContent = (
                        `Activation code expires ${new Date(
                            data.expiryTime
                        ).toLocaleString()}.`
                    );
                }
                elements.result.hidden = false;
                setStatus(
                    elements,
                    "Activation code and DeviceFX QR code generated."
                );
            } catch (error) {
                setStatus(elements, error.message, true);
            } finally {
                elements.generate.disabled = false;
            }
        });

        elements.copyCode.addEventListener("click", () => {
            copyText(
                elements.activationCode.textContent,
                elements,
                "Activation code"
            );
        });
        elements.copyUrl.addEventListener("click", () => {
            copyText(
                elements.onboardingUrl.href,
                elements,
                "DeviceFX URL"
            );
        });
        window.addEventListener(
            "pagehide",
            () => {
                elements.token.value = "";
                loadedToken = "";
            },
            { once: true }
        );
    }

    if (
        typeof module === "object" &&
        module !== null &&
        module.exports
    ) {
        module.exports = {
            ALLOWED_MODELS,
            buildOnboardingUrl,
            callingPeople,
            formatActivationCode,
            responseData
        };
        return;
    }

    initializeDeviceFxApp();
    if (typeof document$ !== "undefined") {
        document$.subscribe(initializeDeviceFxApp);
    }
})();
