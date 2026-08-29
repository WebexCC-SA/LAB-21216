const DCLOUD_DOMAIN_PATTERN =
    /^cb[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.dc-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.com$/i;
const DCLOUD_SESSION_ID_PATTERN = /^[0-9]{4,20}$/;
const STORAGE_CLASS_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function getControlHubCredentials() {
    const domain = (sessionStorage.getItem("dCloudDomain") || "").trim().toLowerCase();
    const sessionId = (sessionStorage.getItem("dCloudSessionId") || "").trim();

    if (!DCLOUD_DOMAIN_PATTERN.test(domain) || !DCLOUD_SESSION_ID_PATTERN.test(sessionId)) {
        return null;
    }

    return {
        username: `cholland@${domain}`,
        password: `dCloud${sessionId.slice(-4)}!`
    };
}

function updateTextByClass(className, value) {
    Array.from(document.getElementsByClassName(className)).forEach((element) => {
        element.textContent = value;
    });
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

    const form = document.querySelector("#info");
    if (form) {
        form.querySelectorAll("input[name]").forEach((input) => {
            const storedValue = sessionStorage.getItem(input.name);
            if (storedValue !== null) {
                input.value = storedValue;
            }
        });
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

    const domainInput = form.querySelector('input[name="dCloudDomain"]');
    const sessionIdInput = form.querySelector('input[name="dCloudSessionId"]');

    if (domainInput && sessionIdInput) {
        const domain = domainInput.value.trim().toLowerCase();
        const sessionId = sessionIdInput.value.trim();

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

        domainInput.value = domain;
        sessionStorage.setItem("dCloudDomain", domain);
        sessionStorage.setItem("dCloudSessionId", sessionId);
        showDCloudFormError("");
    } else {
        form.querySelectorAll("input[name]").forEach((input) => {
            sessionStorage.setItem(input.name, input.value);
        });
    }

    loadem();
}

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
