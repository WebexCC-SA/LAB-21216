const DCLOUD_DOMAIN_PATTERN =
    /^cb[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.dc-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.com$/i;
const DCLOUD_SESSION_ID_PATTERN = /^[0-9]{4,20}$/;
const SMART_AUDIO_DID_PATTERN = /^\+?[0-9]{7,15}$/;
const STORAGE_CLASS_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const DCLOUD_ACCESS_STORAGE_KEY = "dCloudLabAccess";
const DCLOUD_ACCESS_DURATION_MS = 12 * 60 * 60 * 1000;

function normalizeSmartAudioDid(value) {
    const trimmedValue = String(value).trim();
    const digits = trimmedValue.replace(/[^0-9]/g, "");
    return trimmedValue.startsWith("+") ? `+${digits}` : digits;
}

function clearDCloudDetails(storage = globalThis.localStorage) {
    try {
        storage?.removeItem(DCLOUD_ACCESS_STORAGE_KEY);
    } catch {
        // Storage may be unavailable in a restricted browser context.
    }
    try {
        globalThis.sessionStorage?.removeItem("dCloudDomain");
        globalThis.sessionStorage?.removeItem("dCloudSessionId");
        globalThis.sessionStorage?.removeItem("smartAudioDid");
    } catch {
        // Session storage may also be unavailable.
    }
}

function clearDCloudAccess(storage = globalThis.localStorage) {
    clearDCloudDetails(storage);
    try {
        globalThis.labWebexAccess?.clearToken();
    } catch {
        // Bearer token storage may be unavailable.
    }
    try {
        globalThis.labXapiPlayground?.clearSelectedDevice();
    } catch {
        // xAPI device selection storage may be unavailable.
    }
}

function readSessionDCloudAccess() {
    try {
        const domain = (
            globalThis.sessionStorage?.getItem("dCloudDomain") || ""
        ).trim().toLowerCase();
        const sessionId = (
            globalThis.sessionStorage?.getItem("dCloudSessionId") || ""
        ).trim();
        const smartAudioDid = normalizeSmartAudioDid(
            globalThis.sessionStorage?.getItem("smartAudioDid") || ""
        );
        if (
            DCLOUD_DOMAIN_PATTERN.test(domain) &&
            DCLOUD_SESSION_ID_PATTERN.test(sessionId) &&
            SMART_AUDIO_DID_PATTERN.test(smartAudioDid)
        ) {
            return { domain, sessionId, smartAudioDid, expiresAt: null };
        }
    } catch {
        // Session storage may be unavailable.
    }
    return null;
}

function saveDCloudAccess(
    domain,
    sessionId,
    smartAudioDid,
    storage = globalThis.localStorage,
    now = Date.now()
) {
    const normalizedDomain = String(domain).trim().toLowerCase();
    const normalizedSessionId = String(sessionId).trim();
    const normalizedSmartAudioDid = normalizeSmartAudioDid(smartAudioDid);
    if (
        !DCLOUD_DOMAIN_PATTERN.test(normalizedDomain) ||
        !DCLOUD_SESSION_ID_PATTERN.test(normalizedSessionId) ||
        !SMART_AUDIO_DID_PATTERN.test(normalizedSmartAudioDid)
    ) {
        return false;
    }

    try {
        storage?.setItem(
            DCLOUD_ACCESS_STORAGE_KEY,
            JSON.stringify({
                domain: normalizedDomain,
                sessionId: normalizedSessionId,
                smartAudioDid: normalizedSmartAudioDid,
                expiresAt: now + DCLOUD_ACCESS_DURATION_MS
            })
        );
        try {
            globalThis.sessionStorage?.removeItem("dCloudDomain");
            globalThis.sessionStorage?.removeItem("dCloudSessionId");
            globalThis.sessionStorage?.removeItem("smartAudioDid");
        } catch {
            // The persistent copy is sufficient.
        }
        return Boolean(storage);
    } catch {
        try {
            globalThis.sessionStorage?.setItem(
                "dCloudDomain",
                normalizedDomain
            );
            globalThis.sessionStorage?.setItem(
                "dCloudSessionId",
                normalizedSessionId
            );
            globalThis.sessionStorage?.setItem(
                "smartAudioDid",
                normalizedSmartAudioDid
            );
        } catch {
            // Both browser storage mechanisms are unavailable.
        }
        return false;
    }
}

function readDCloudAccess(
    storage = globalThis.localStorage,
    now = Date.now()
) {
    let storedValue;
    try {
        storedValue = storage?.getItem(DCLOUD_ACCESS_STORAGE_KEY);
    } catch {
        return readSessionDCloudAccess();
    }
    if (!storedValue) {
        return readSessionDCloudAccess();
    }

    try {
        const access = JSON.parse(storedValue);
        const domain = String(access.domain || "").trim().toLowerCase();
        const sessionId = String(access.sessionId || "").trim();
        const smartAudioDid = normalizeSmartAudioDid(access.smartAudioDid || "");
        if (
            !DCLOUD_DOMAIN_PATTERN.test(domain) ||
            !DCLOUD_SESSION_ID_PATTERN.test(sessionId) ||
            !SMART_AUDIO_DID_PATTERN.test(smartAudioDid) ||
            !Number.isFinite(access.expiresAt) ||
            access.expiresAt <= now
        ) {
            clearDCloudDetails(storage);
            return null;
        }
        return {
            domain,
            sessionId,
            smartAudioDid,
            expiresAt: access.expiresAt
        };
    } catch {
        clearDCloudDetails(storage);
        return null;
    }
}

function getControlHubCredentials(
    storage = globalThis.localStorage,
    now = Date.now()
) {
    const access = readDCloudAccess(storage, now);
    if (!access) {
        return null;
    }

    return {
        username: `cholland@${access.domain}`,
        password: `dCloud${access.sessionId.slice(-4)}!`
    };
}

function updateTextByClass(className, value) {
    Array.from(document.getElementsByClassName(className)).forEach((element) => {
        element.textContent = value;
    });
}

function getDCloudInputs(form = document.querySelector("#info")) {
    if (!form) {
        return null;
    }
    const getInput = (name) =>
        form.elements?.namedItem(name) ||
        document.querySelector(`input[name="${name}"][form="${form.id}"]`);
    const inputs = {
        domain: getInput("dCloudDomain"),
        sessionId: getInput("dCloudSessionId"),
        smartAudioDid: getInput("smartAudioDid")
    };
    return Object.values(inputs).every(Boolean) ? inputs : null;
}

function updateDCloudSummary(inputs) {
    const summaryValues = {
        "dcloud-summary-session-id": inputs?.sessionId.value.trim(),
        "dcloud-summary-domain": inputs?.domain.value.trim(),
        "dcloud-summary-smart-audio-did": inputs?.smartAudioDid.value.trim()
    };
    Object.entries(summaryValues).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || "Not entered";
        }
    });
}

function updateDCloudAccessFromInputs(inputs) {
    const domain = inputs.domain.value.trim().toLowerCase();
    const sessionId = inputs.sessionId.value.trim();
    const smartAudioDid = normalizeSmartAudioDid(inputs.smartAudioDid.value);

    try {
        globalThis.sessionStorage?.setItem("dCloudDomain", domain);
        globalThis.sessionStorage?.setItem("dCloudSessionId", sessionId);
        globalThis.sessionStorage?.setItem("smartAudioDid", smartAudioDid);
    } catch {
        // Values can still be used on the current page.
    }

    updateDCloudSummary(inputs);
    if (
        !DCLOUD_DOMAIN_PATTERN.test(domain) ||
        !DCLOUD_SESSION_ID_PATTERN.test(sessionId) ||
        !SMART_AUDIO_DID_PATTERN.test(smartAudioDid)
    ) {
        showDCloudFormError(
            "Continue entering the session ID, domain, and Smart Audio DID."
        );
        return;
    }

    inputs.domain.value = domain;
    inputs.smartAudioDid.value = smartAudioDid;
    if (saveDCloudAccess(domain, sessionId, smartAudioDid)) {
        showDCloudFormError(
            "All three values are saved in this browser for 12 hours."
        );
    } else {
        showDCloudFormError(
            "Values applied, but this browser blocked 12-hour storage."
        );
    }
    updateDCloudSummary(inputs);

    const credentials = getControlHubCredentials();
    if (credentials) {
        updateTextByClass("ControlHubUsername", credentials.username);
        updateTextByClass("ControlHubPassword", credentials.password);
    }
    updateTextByClass("SmartAudioDid", smartAudioDid);
}

function loadem() {
    Object.keys(sessionStorage).forEach((key) => {
        if (STORAGE_CLASS_PATTERN.test(key)) {
            updateTextByClass(key, sessionStorage.getItem(key) || "");
        }
    });

    const credentials = getControlHubCredentials();
    if (credentials) {
        updateTextByClass("ControlHubUsername", credentials.username);
        updateTextByClass("ControlHubPassword", credentials.password);
    }

    const access = readDCloudAccess();
    if (access) {
        updateTextByClass("SmartAudioDid", access.smartAudioDid);
    }

    const form = document.querySelector("#info");
    if (form) {
        const inputs = getDCloudInputs(form);
        if (inputs) {
            const accessValues = access
                ? {
                      dCloudDomain: access.domain,
                      dCloudSessionId: access.sessionId,
                      smartAudioDid: access.smartAudioDid
                  }
                : {};
            Object.values(inputs).forEach((input) => {
                const draftValue = sessionStorage.getItem(input.name);
                input.value =
                    draftValue !== null
                        ? draftValue
                        : accessValues[input.name] || "";
                if (input.dataset.dcloudCaptureInitialized !== "true") {
                    input.dataset.dcloudCaptureInitialized = "true";
                    input.addEventListener("input", () => {
                        updateDCloudAccessFromInputs(inputs);
                    });
                }
            });
            updateDCloudSummary(inputs);
        } else {
            form.querySelectorAll("input[name]").forEach((input) => {
                input.value = sessionStorage.getItem(input.name) || "";
            });
        }
        const clearButton = form.querySelector("#dcloud-clear-saved");
        if (clearButton && clearButton.dataset.initialized !== "true") {
            clearButton.dataset.initialized = "true";
            clearButton.addEventListener("click", () => {
                clearDCloudAccess();
                form.reset();
                if (inputs) {
                    Object.values(inputs).forEach((input) => {
                        input.value = "";
                    });
                    updateDCloudSummary(inputs);
                }
                updateTextByClass(
                    "ControlHubUsername",
                    "Enter your dCloud details above"
                );
                updateTextByClass(
                    "ControlHubPassword",
                    "Enter your dCloud details above"
                );
                updateTextByClass(
                    "SmartAudioDid",
                    "Enter your Smart Audio DID in Overview"
                );
                showDCloudFormError("All saved Lab Access values cleared.");
            });
        }
    }
}

function showDCloudFormError(message) {
    const errorElement = document.querySelector("#dcloud-form-error");
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function setValues(event) {
    const currentEvent = event || window.event;
    const form =
        currentEvent?.target?.closest("form") ||
        document.querySelector("#info");

    currentEvent?.preventDefault();
    if (!form) {
        return;
    }

    const dCloudInputs = getDCloudInputs(form);
    const domainInput = dCloudInputs?.domain;
    const sessionIdInput = dCloudInputs?.sessionId;
    const smartAudioDidInput = dCloudInputs?.smartAudioDid;

    if (domainInput && sessionIdInput && smartAudioDidInput) {
        const domain = domainInput.value.trim().toLowerCase();
        const sessionId = sessionIdInput.value.trim();
        const smartAudioDid = normalizeSmartAudioDid(
            smartAudioDidInput.value
        );

        if (!DCLOUD_DOMAIN_PATTERN.test(domain)) {
            showDCloudFormError("Enter a domain in the format cbXXX.dc-YY.com.");
            domainInput.focus();
            return;
        }
        if (!DCLOUD_SESSION_ID_PATTERN.test(sessionId)) {
            showDCloudFormError("Enter a session ID containing 4 to 20 digits.");
            sessionIdInput.focus();
            return;
        }
        if (!SMART_AUDIO_DID_PATTERN.test(smartAudioDid)) {
            showDCloudFormError(
                "Enter a valid Smart Audio DID containing 7 to 15 digits."
            );
            smartAudioDidInput.focus();
            return;
        }

        domainInput.value = domain;
        smartAudioDidInput.value = smartAudioDid;
        if (saveDCloudAccess(domain, sessionId, smartAudioDid)) {
            showDCloudFormError(
                "All three values are saved in this browser for 12 hours."
            );
        } else {
            showDCloudFormError(
                "Values applied, but this browser blocked 12-hour storage."
            );
        }
    } else {
        form.querySelectorAll("input[name]").forEach((input) => {
            sessionStorage.setItem(input.name, input.value);
        });
    }

    loadem();
}

if (typeof document !== "undefined") {
    document.addEventListener("click", (event) => {
        const copyElement = event.target.closest("copy");
        if (copyElement) {
            navigator.clipboard.writeText(copyElement.innerText);
        }
    });

    loadem();

    if (typeof document$ !== "undefined") {
        document$.subscribe(loadem);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        DCLOUD_ACCESS_DURATION_MS,
        SMART_AUDIO_DID_PATTERN,
        clearDCloudAccess,
        clearDCloudDetails,
        getControlHubCredentials,
        normalizeSmartAudioDid,
        readDCloudAccess,
        saveDCloudAccess
    };
}
