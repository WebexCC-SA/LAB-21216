(() => {
    "use strict";

    const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{20,8192}$/;
    const TOKEN_STORAGE_KEY = "webexLabAccess";
    const TOKEN_STORAGE_DURATION_MS = 12 * 60 * 60 * 1000;
    let activeToken = "";
    let lastStorePersisted = false;

    function normalizeToken(value) {
        return String(value || "").trim().replace(/^Bearer\s+/i, "");
    }

    function clearToken(storage = globalThis.localStorage) {
        activeToken = "";
        lastStorePersisted = false;
        try {
            storage?.removeItem(TOKEN_STORAGE_KEY);
        } catch {
            // Storage may be unavailable in a restricted browser context.
        }
    }

    function readStoredToken(
        storage = globalThis.localStorage,
        now = Date.now()
    ) {
        let storedValue;
        try {
            storedValue = storage?.getItem(TOKEN_STORAGE_KEY);
        } catch {
            return "";
        }
        if (!storedValue) {
            return "";
        }
        try {
            const access = JSON.parse(storedValue);
            const token = normalizeToken(access.token);
            if (
                !TOKEN_PATTERN.test(token) ||
                !Number.isFinite(access.expiresAt) ||
                access.expiresAt <= now
            ) {
                clearToken(storage);
                return "";
            }
            return token;
        } catch {
            clearToken(storage);
            return "";
        }
    }

    function storeToken(
        value,
        storage = globalThis.localStorage,
        now = Date.now()
    ) {
        const token = normalizeToken(value);
        if (!TOKEN_PATTERN.test(token)) {
            return false;
        }
        activeToken = token;
        lastStorePersisted = false;
        try {
            storage?.setItem(
                TOKEN_STORAGE_KEY,
                JSON.stringify({
                    token,
                    expiresAt: now + TOKEN_STORAGE_DURATION_MS
                })
            );
            lastStorePersisted = Boolean(storage);
        } catch {
            // Keep the valid token in memory when storage is blocked.
        }
        return true;
    }

    function getToken() {
        if (!activeToken) {
            activeToken = readStoredToken();
        }
        return activeToken;
    }

    function isTokenPersisted() {
        return lastStorePersisted || Boolean(readStoredToken());
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
                "Saved bearer token is available for up to 12 hours."
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
            status.textContent = isTokenPersisted()
                ? "Saved in this browser for up to 12 hours."
                : "Token is available in memory, but browser storage is blocked.";
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
                        "A saved bearer token is available for this lab."
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
                    status.textContent = isTokenPersisted()
                        ? "Token saved for up to 12 hours and ready for DeviceFX."
                        : "Token is ready, but browser storage is blocked.";
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
            TOKEN_STORAGE_DURATION_MS,
            clearToken,
            getToken,
            isTokenPersisted,
            normalizeToken,
            readStoredToken,
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
