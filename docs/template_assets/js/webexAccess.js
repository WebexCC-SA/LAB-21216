(() => {
    "use strict";

    const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{20,8192}$/;
    let activeToken = "";

    function normalizeToken(value) {
        return String(value || "").trim().replace(/^Bearer\s+/i, "");
    }

    function clearToken() {
        activeToken = "";
    }

    function storeToken(value) {
        const token = normalizeToken(value);
        if (!TOKEN_PATTERN.test(token)) {
            return false;
        }
        activeToken = token;
        return true;
    }

    function getToken() {
        return activeToken;
    }

    function initialize() {
        const card = document.querySelector("#webex-access-card");
        if (!card || card.dataset.initialized === "true") {
            return;
        }
        card.dataset.initialized = "true";

        const input = card.querySelector("#webex-admin-token");
        const toggle = card.querySelector("#webex-token-toggle");
        const save = card.querySelector("#webex-token-save");
        const clear = card.querySelector("#webex-token-clear");
        const status = card.querySelector("#webex-token-status");
        if (!input || !toggle || !save || !clear || !status) {
            return;
        }

        const existingToken = getToken();
        if (existingToken) {
            input.value = existingToken;
            status.textContent = (
                "Bearer token is available for this open lab-guide session."
            );
        }

        toggle.addEventListener("click", () => {
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            toggle.textContent = showing ? "Show" : "Hide";
            toggle.setAttribute("aria-pressed", String(!showing));
            input.focus();
        });

        save.addEventListener("click", () => {
            if (!storeToken(input.value)) {
                status.textContent = (
                    "Enter a valid bearer token. It was not saved."
                );
                status.classList.add("lab-access-status-error");
                input.focus();
                return;
            }
            input.value = getToken();
            status.textContent = (
                "Available during this open lab-guide session. It is not written to browser storage."
            );
            status.classList.remove("lab-access-status-error");
        });

        clear.addEventListener("click", () => {
            clearToken();
            input.value = "";
            input.type = "password";
            toggle.textContent = "Show";
            toggle.setAttribute("aria-pressed", "false");
            status.textContent = "Bearer token cleared.";
            status.classList.remove("lab-access-status-error");
        });
    }

    function initializeInlineEntries() {
        document.querySelectorAll("[data-webex-token-entry]").forEach(
            (entry) => {
                if (entry.dataset.initialized === "true") {
                    return;
                }
                entry.dataset.initialized = "true";
                const input = entry.querySelector("[data-webex-token-input]");
                const toggle = entry.querySelector("[data-webex-token-toggle]");
                const use = entry.querySelector("[data-webex-token-use]");
                const status = entry.querySelector("[data-webex-token-status]");
                if (!input || !toggle || !use || !status) {
                    return;
                }

                const existingToken = getToken();
                if (existingToken) {
                    input.value = existingToken;
                    status.textContent = (
                        "A bearer token is available for this lab-guide session."
                    );
                }

                toggle.addEventListener("click", () => {
                    const showing = input.type === "text";
                    input.type = showing ? "password" : "text";
                    toggle.textContent = showing ? "Show" : "Hide";
                    toggle.setAttribute("aria-pressed", String(!showing));
                    input.focus();
                });

                use.addEventListener("click", () => {
                    if (!storeToken(input.value)) {
                        status.textContent = (
                            "Enter a valid bearer token and try again."
                        );
                        status.classList.add("lab-access-status-error");
                        input.focus();
                        return;
                    }
                    input.value = getToken();
                    status.textContent = (
                        "Token ready for the DeviceFX workflow."
                    );
                    status.classList.remove("lab-access-status-error");
                    window.dispatchEvent(new CustomEvent("lab-webex-token-set"));
                });
            }
        );
    }

    if (
        typeof module === "object" &&
        module !== null &&
        module.exports
    ) {
        module.exports = {
            clearToken,
            getToken,
            normalizeToken,
            storeToken
        };
        return;
    }

    window.labWebexAccess = Object.freeze({ clearToken, getToken });
    initialize();
    initializeInlineEntries();
    if (typeof document$ !== "undefined") {
        document$.subscribe(() => {
            initialize();
            initializeInlineEntries();
        });
    }
})();
