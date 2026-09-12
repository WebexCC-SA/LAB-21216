(() => {
    "use strict";

    const encodedInfo = window.location.search.slice(1);
    if (!encodedInfo) {
        return;
    }

    try {
        const info = JSON.parse(atob(encodedInfo));
        if (!info || typeof info !== "object" || Array.isArray(info)) {
            return;
        }

        if (
            typeof info.dCloudDomain === "string" &&
            typeof info.dCloudSessionId === "string" &&
            typeof info.smartAudioDid === "string"
        ) {
            saveDCloudAccess(
                info.dCloudDomain,
                info.dCloudSessionId,
                info.smartAudioDid
            );
        } else {
            ["dCloudDomain", "dCloudSessionId", "smartAudioDid"].forEach(
                (key) => {
                    if (typeof info[key] === "string") {
                        sessionStorage.setItem(key, info[key]);
                    }
                }
            );
        }

        Object.entries(info).forEach(([key, value]) => {
            if (
                key !== "dCloudDomain" &&
                key !== "dCloudSessionId" &&
                key !== "smartAudioDid" &&
                STORAGE_CLASS_PATTERN.test(key) &&
                typeof value === "string"
            ) {
                sessionStorage.setItem(key, value);
            }
        });

        loadem();
        history.replaceState(
            null,
            "",
            window.location.pathname + window.location.hash
        );
    } catch {
        // Ignore malformed or non-base64 query data.
    }
})();