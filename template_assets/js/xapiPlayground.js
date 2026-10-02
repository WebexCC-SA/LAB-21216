(() => {
    "use strict";

    const DEVICES_URL = "https://webexapis.com/v1/devices?max=100";
    const SCREENSHOT_URL =
        "https://webexapis.com/v1/xapi/command/Ui.GetDeviceScreenshot";
    const LOCAL_EDITOR_API = "http://127.0.0.1:8765";
    const DEVICE_STORAGE_KEY = "xapiPlaygroundDevice";
    const DEVICE_STORAGE_DURATION_MS = 12 * 60 * 60 * 1000;
    const REQUEST_TIMEOUT_MS = 20000;
    const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
    const WEBEX_ID_PATTERN = /^[A-Za-z0-9._~+/=-]{1,512}$/;
    const PHONEOS_PRODUCT_PATTERN =
        /(?:phoneos|(?:cisco\s+)?(?:desk\s+phone\s+)?(?:98\d{2}|8875))/i;

    let activeRequestController = null;
    let pageController = null;
    let localEditorToken = "";
    let screenshotObjectUrl = "";

    function bearerToken() {
        return window.labWebexAccess?.getToken() || "";
    }

    function normalizeDevice(device) {
        if (
            !device ||
            typeof device.id !== "string" ||
            !WEBEX_ID_PATTERN.test(device.id) ||
            !Array.isArray(device.permissions) ||
            !device.permissions.some(
                (permission) =>
                    typeof permission === "string" &&
                    permission.toLowerCase() === "xapi"
            )
        ) {
            return null;
        }

        const product = typeof device.product === "string"
            ? device.product.trim()
            : "";
        const type = typeof device.type === "string"
            ? device.type.trim()
            : "";
        if (
            !PHONEOS_PRODUCT_PATTERN.test(product) &&
            !type.toLowerCase().includes("phone")
        ) {
            return null;
        }

        const displayName = typeof device.displayName === "string"
            ? device.displayName.trim()
            : "";
        const connectionStatus =
            typeof device.connectionStatus === "string"
                ? device.connectionStatus.trim()
                : "";
        return {
            id: device.id,
            displayName: displayName || product || "PhoneOS device",
            product: product || "PhoneOS",
            connectionStatus
        };
    }

    function eligibleDevices(items) {
        if (!Array.isArray(items)) {
            throw new Error("Webex returned an invalid device list.");
        }
        const devices = items
            .map(normalizeDevice)
            .filter(Boolean);
        devices.sort((first, second) =>
            first.displayName.localeCompare(second.displayName)
        );
        return devices;
    }

    function saveSelectedDevice(
        deviceId,
        storage = globalThis.localStorage,
        now = Date.now()
    ) {
        if (!WEBEX_ID_PATTERN.test(String(deviceId))) {
            return false;
        }
        try {
            storage?.setItem(
                DEVICE_STORAGE_KEY,
                JSON.stringify({
                    deviceId,
                    expiresAt: now + DEVICE_STORAGE_DURATION_MS
                })
            );
            return Boolean(storage);
        } catch {
            return false;
        }
    }

    function clearSelectedDevice(storage = globalThis.localStorage) {
        try {
            storage?.removeItem(DEVICE_STORAGE_KEY);
        } catch {
            // Storage may be unavailable in a restricted browser context.
        }
    }

    function readSelectedDevice(
        storage = globalThis.localStorage,
        now = Date.now()
    ) {
        let storedValue;
        try {
            storedValue = storage?.getItem(DEVICE_STORAGE_KEY);
        } catch {
            return "";
        }
        if (!storedValue) {
            return "";
        }
        try {
            const selection = JSON.parse(storedValue);
            if (
                !WEBEX_ID_PATTERN.test(String(selection.deviceId || "")) ||
                !Number.isFinite(selection.expiresAt) ||
                selection.expiresAt <= now
            ) {
                clearSelectedDevice(storage);
                return "";
            }
            return selection.deviceId;
        } catch {
            clearSelectedDevice(storage);
            return "";
        }
    }

    function screenshotRequest(deviceId) {
        if (!WEBEX_ID_PATTERN.test(String(deviceId))) {
            throw new Error("Select a valid PhoneOS device.");
        }
        return { deviceId };
    }

    function requestText(url, body) {
        return [
            `POST ${url}`,
            "Authorization: Bearer [saved sandbox token]",
            "Content-Type: application/json",
            "",
            JSON.stringify(body, null, 2)
        ].join("\n");
    }

    function base64Bytes(value) {
        const dataUrlMatch = String(value).match(
            /^data:(image\/(?:png|jpeg));base64,(.+)$/is
        );
        const encoded = (
            dataUrlMatch ? dataUrlMatch[2] : String(value)
        ).replace(/\s+/g, "");
        if (
            encoded.length < 100 ||
            encoded.length > Math.ceil(MAX_SCREENSHOT_BYTES * 4 / 3) + 4 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
        ) {
            return null;
        }
        let binary;
        try {
            binary = atob(encoded);
        } catch {
            return null;
        }
        if (!binary.length || binary.length > MAX_SCREENSHOT_BYTES) {
            return null;
        }
        const bytes = Uint8Array.from(binary, (character) =>
            character.charCodeAt(0)
        );
        let mime = "";
        let extension = "";
        if (
            bytes.length >= 8 &&
            bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47 &&
            bytes[4] === 0x0d &&
            bytes[5] === 0x0a &&
            bytes[6] === 0x1a &&
            bytes[7] === 0x0a
        ) {
            mime = "image/png";
            extension = "png";
        } else if (
            bytes.length >= 3 &&
            bytes[0] === 0xff &&
            bytes[1] === 0xd8 &&
            bytes[2] === 0xff
        ) {
            mime = "image/jpeg";
            extension = "jpg";
        } else {
            return null;
        }
        return { bytes, mime, extension };
    }

    function screenshotImage(response) {
        if (!response || typeof response !== "object") {
            throw new Error("Webex returned an invalid screenshot response.");
        }
        const candidates = [];
        const visit = (value) => {
            if (typeof value === "string") {
                if (value.length >= 100) {
                    candidates.push(value);
                }
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (value && typeof value === "object") {
                Object.values(value).forEach(visit);
            }
        };
        visit(response.result);
        candidates.sort((first, second) => second.length - first.length);
        for (const candidate of candidates) {
            const image = base64Bytes(candidate);
            if (image) {
                return image;
            }
        }
        throw new Error(
            "The selected device did not return a valid PNG or JPEG screenshot."
        );
    }

    function getElements(app) {
        const byId = (id) => {
            const element = app.querySelector(`#${id}`);
            if (!element) {
                throw new Error(`Utilities element is missing: ${id}`);
            }
            return element;
        };
        return {
            setupOnly: [
                ...document.querySelectorAll(".playground-setup-only")
            ],
            setupToggle: byId("playground-setup-toggle"),
            tokenPrerequisite: byId("xapi-token-prerequisite"),
            phonePrerequisite: byId("xapi-phone-prerequisite"),
            device: byId("xapi-device"),
            loadDevices: byId("xapi-load-devices"),
            clearDevice: byId("xapi-clear-device"),
            status: byId("xapi-status"),
            screenshot: byId("xapi-screenshot"),
            screenshotRequest: byId("xapi-screenshot-request"),
            screenshotResult: byId("xapi-screenshot-result"),
            screenshotImage: byId("xapi-screenshot-image"),
            screenshotDownload: byId("xapi-screenshot-download")
        };
    }

    function renderSetupVisibility(elements) {
        const showSetup = !elements.setupReady || elements.setupExpanded;
        elements.setupOnly.forEach((element) => {
            element.hidden = !showSetup;
        });
        elements.setupToggle.hidden = !elements.setupReady;
        elements.setupToggle.setAttribute(
            "aria-expanded",
            String(elements.setupExpanded)
        );
        elements.setupToggle.textContent = elements.setupExpanded
            ? "Hide setup details"
            : "Setup details";
    }

    function setSetupReady(elements, ready) {
        elements.setupReady = ready;
        if (!ready) {
            elements.setupExpanded = false;
        }
        renderSetupVisibility(elements);
    }

    function setStatus(elements, message, isError = false) {
        elements.status.textContent = message;
        elements.status.classList.toggle("xapi-status-error", isError);
    }

    function setPrerequisite(element, message, isError) {
        element.textContent = message;
        element.classList.toggle("xapi-prerequisite-error", isError);
    }

    function updatePrerequisites(elements) {
        const tokenAvailable = Boolean(bearerToken());
        setPrerequisite(
            elements.tokenPrerequisite,
            tokenAvailable ? "Ready" : "Required",
            !tokenAvailable
        );
    }

    function selectedDevice(elements) {
        const option = elements.device.selectedOptions[0];
        if (!option || !option.value) {
            return null;
        }
        return {
            id: option.value,
            label: option.dataset.label || option.textContent || "PhoneOS device"
        };
    }

    function updateActions(elements) {
        updatePrerequisites(elements);
        const selected = selectedDevice(elements);
        elements.screenshot.disabled = !selected;
        elements.clearDevice.disabled = !selected;
        elements.screenshotRequest.textContent = requestText(
            SCREENSHOT_URL,
            {
                deviceId: selected?.id || "[select a PhoneOS device]"
            }
        );
    }

    function resetScreenshot(elements) {
        if (screenshotObjectUrl) {
            URL.revokeObjectURL(screenshotObjectUrl);
            screenshotObjectUrl = "";
        }
        elements.screenshotImage.removeAttribute("src");
        elements.screenshotDownload.removeAttribute("href");
        elements.screenshotResult.hidden = true;
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
                    "The Webex request timed out. Verify the phone is online and try again."
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

    function webexErrorDetail(data) {
        const candidates = [
            data?.message,
            data?.error,
            data?.errors?.[0]?.description,
            data?.errors?.[0]?.message
        ];
        const detail = candidates.find(
            (candidate) =>
                typeof candidate === "string" &&
                candidate.trim().length > 0
        );
        return detail ? ` Webex detail: ${detail.trim().slice(0, 300)}` : "";
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
                    "The bearer token is invalid or expired. Save a new token in Lab Access."
                );
            }
            if (response.status === 403) {
                throw new Error(
                    "Webex refused this operation. Confirm the token scope and the selected device's xAPI permissions." +
                    webexErrorDetail(data)
                );
            }
            if (response.status === 404) {
                throw new Error(
                    "The selected device or xAPI command is unavailable."
                );
            }
            if (response.status === 409) {
                throw new Error(
                    "The selected phone is not ready for this xAPI command."
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
                `Webex rejected the request (HTTP ${response.status}).` +
                webexErrorDetail(data)
            );
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Webex returned an invalid response object.");
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
                "Local preview requires the Lab service. Run python scripts/image_size_editor.py and try again."
            );
        }
        if (!response.ok) {
            throw new Error(
                "The local Lab service could not be authorized."
            );
        }
        const config = await response.json();
        if (!config || typeof config.token !== "string") {
            throw new Error(
                "The local Lab service returned invalid configuration."
            );
        }
        localEditorToken = config.token;
        return localEditorToken;
    }

    async function webexRequest(operation, token, body = {}) {
        if (!isLocalPreview()) {
            const urls = {
                devices: DEVICES_URL,
                "xapi-screenshot": SCREENSHOT_URL
            };
            return apiRequest(urls[operation], {
                method: operation === "devices" ? "GET" : "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(operation === "devices"
                        ? {}
                        : { "Content-Type": "application/json" })
                },
                ...(operation === "devices"
                    ? {}
                    : { body: JSON.stringify(body) })
            });
        }

        const proxyBody = {
            bearer_token: token,
            device_id: body.deviceId
        };
        const sendRequest = async () =>
            apiRequest(`${LOCAL_EDITOR_API}/webex-proxy/${operation}`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Image-Editor-Token": await getLocalEditorToken()
                },
                body: JSON.stringify(proxyBody)
            });
        let response = await sendRequest();
        if (response.status === 403) {
            localEditorToken = "";
            response = await sendRequest();
        }
        return response;
    }

    function populateDevices(elements, devices) {
        elements.device.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a PhoneOS device";
        elements.device.append(placeholder);

        devices.forEach((device) => {
            const option = document.createElement("option");
            option.value = device.id;
            const status = device.connectionStatus
                ? ` · ${device.connectionStatus}`
                : "";
            option.textContent =
                `${device.displayName} · ${device.product}${status}`;
            option.dataset.label = `${device.displayName} (${device.product})`;
            elements.device.append(option);
        });
        elements.device.disabled = false;

        const storedDeviceId = readSelectedDevice();
        if ([...elements.device.options].some(
            (option) => option.value === storedDeviceId
        )) {
            elements.device.value = storedDeviceId;
        } else if (storedDeviceId) {
            clearSelectedDevice();
        }
        updateActions(elements);
    }

    async function loadDevices(elements) {
        const token = bearerToken();
        updatePrerequisites(elements);
        if (!token) {
            setSetupReady(elements, false);
            setStatus(
                elements,
                "Save the sandbox bearer token above or under Lab > Overview > Lab Access.",
                true
            );
            return;
        }

        elements.loadDevices.disabled = true;
        elements.device.disabled = true;
        elements.phonePrerequisite.textContent = "Checking…";
        setStatus(elements, "Loading compatible PhoneOS devices…");
        try {
            const response = await webexRequest("devices", token);
            const data = await responseData(response);
            const devices = eligibleDevices(data.items);
            if (!devices.length) {
                throw new Error(
                    "No compatible PhoneOS devices were found. Complete Lab 1, verify PhoneOS 3.5+, and confirm the token has device access."
                );
            }
            populateDevices(elements, devices);
            setSetupReady(elements, true);
            setPrerequisite(
                elements.phonePrerequisite,
                `${devices.length} available`,
                false
            );
            setStatus(
                elements,
                `Loaded ${devices.length} compatible PhoneOS device${devices.length === 1 ? "" : "s"}.`
            );
        } catch (error) {
            setSetupReady(elements, false);
            elements.device.replaceChildren();
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No devices loaded";
            elements.device.append(option);
            setPrerequisite(elements.phonePrerequisite, "Not verified", true);
            updateActions(elements);
            setStatus(elements, error.message, true);
        } finally {
            elements.loadDevices.disabled = false;
        }
    }

    function renderScreenshot(elements, image, device) {
        resetScreenshot(elements);
        const blob = new Blob([image.bytes], { type: image.mime });
        screenshotObjectUrl = URL.createObjectURL(blob);
        elements.screenshotImage.src = screenshotObjectUrl;
        elements.screenshotDownload.href = screenshotObjectUrl;
        elements.screenshotDownload.download =
            `phone-screenshot-${Date.now()}.${image.extension}`;
        elements.screenshotResult.hidden = false;
        setStatus(
            elements,
            `Screenshot captured from ${device.label}.`
        );
    }

    function initializeXapiPlayground() {
        const app = document.querySelector("#xapi-playground-app");
        if (app?.dataset.initialized === "true") {
            return;
        }

        activeRequestController?.abort();
        pageController?.abort();
        pageController = null;
        if (screenshotObjectUrl) {
            URL.revokeObjectURL(screenshotObjectUrl);
            screenshotObjectUrl = "";
        }

        if (!app) {
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
        pageController = new AbortController();
        const signal = pageController.signal;
        elements.setupReady = false;
        elements.setupExpanded = false;

        updateActions(elements);
        renderSetupVisibility(elements);

        elements.setupToggle.addEventListener(
            "click",
            () => {
                elements.setupExpanded = !elements.setupExpanded;
                renderSetupVisibility(elements);
            },
            { signal }
        );
        elements.loadDevices.addEventListener(
            "click",
            () => loadDevices(elements),
            { signal }
        );
        elements.device.addEventListener(
            "change",
            () => {
                resetScreenshot(elements);
                const selected = selectedDevice(elements);
                if (selected) {
                    saveSelectedDevice(selected.id);
                    setStatus(
                        elements,
                        `${selected.label} selected for 12 hours.`
                    );
                } else {
                    clearSelectedDevice();
                }
                updateActions(elements);
            },
            { signal }
        );
        elements.clearDevice.addEventListener(
            "click",
            () => {
                clearSelectedDevice();
                elements.device.value = "";
                resetScreenshot(elements);
                updateActions(elements);
                setStatus(elements, "Saved device selection cleared.");
            },
            { signal }
        );
        elements.screenshot.addEventListener(
            "click",
            async () => {
                const token = bearerToken();
                const device = selectedDevice(elements);
                if (!token || !device) {
                    updateActions(elements);
                    setStatus(
                        elements,
                        "Save a bearer token and select a PhoneOS device.",
                        true
                    );
                    return;
                }
                resetScreenshot(elements);
                elements.screenshot.disabled = true;
                setStatus(elements, "Capturing the phone display…");
                try {
                    const response = await webexRequest(
                        "xapi-screenshot",
                        token,
                        screenshotRequest(device.id)
                    );
                    const data = await responseData(response);
                    renderScreenshot(
                        elements,
                        screenshotImage(data),
                        device
                    );
                } catch (error) {
                    setStatus(elements, error.message, true);
                } finally {
                    updateActions(elements);
                }
            },
            { signal }
        );
        window.addEventListener(
            "lab-webex-token-set",
            () => {
                updateActions(elements);
                loadDevices(elements);
            },
            { signal }
        );

        if (bearerToken()) {
            loadDevices(elements);
        } else {
            setStatus(
                elements,
                "Save the sandbox bearer token to load your phones."
            );
        }
    }

    if (
        typeof module === "object" &&
        module !== null &&
        module.exports
    ) {
        module.exports = {
            DEVICE_STORAGE_DURATION_MS,
            base64Bytes,
            eligibleDevices,
            readSelectedDevice,
            responseData,
            saveSelectedDevice,
            setSetupReady,
            screenshotImage,
            screenshotRequest,
            webexErrorDetail
        };
        return;
    }

    window.labXapiPlayground = Object.freeze({ clearSelectedDevice });
    initializeXapiPlayground();
    if (typeof document$ !== "undefined") {
        document$.subscribe(initializeXapiPlayground);
    }
})();
