"use strict";

const assert = require("node:assert/strict");
const {
    DCLOUD_ACCESS_DURATION_MS,
    clearDCloudAccess,
    getControlHubCredentials,
    normalizeSmartAudioDid,
    readDCloudAccess,
    saveDCloudAccess
} = require("../docs/template_assets/js/newLoad.js");

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    removeItem(key) {
        this.values.delete(key);
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }
}

const start = Date.UTC(2026, 8, 4, 12);
const storage = new MemoryStorage();

assert.equal(DCLOUD_ACCESS_DURATION_MS, 12 * 60 * 60 * 1000);
assert.equal(
    saveDCloudAccess(
        " CB122.DC-01.COM ",
        "1168643",
        "919-991 2389",
        storage,
        start
    ),
    true
);
assert.deepEqual(readDCloudAccess(storage, start + 1), {
    domain: "cb122.dc-01.com",
    sessionId: "1168643",
    smartAudioDid: "9199912389",
    expiresAt: start + DCLOUD_ACCESS_DURATION_MS
});
assert.deepEqual(getControlHubCredentials(storage, start + 1), {
    username: "cholland@cb122.dc-01.com",
    password: "dCloud8643!"
});

assert.equal(
    readDCloudAccess(storage, start + DCLOUD_ACCESS_DURATION_MS),
    null
);
assert.equal(storage.values.size, 0);

assert.equal(
    saveDCloudAccess("example.com", "1168643", "9199912389", storage, start),
    false
);
assert.equal(
    saveDCloudAccess("cb122.dc-01.com", "abc", "9199912389", storage, start),
    false
);
assert.equal(
    saveDCloudAccess("cb122.dc-01.com", "1168643", "not-a-DID", storage, start),
    false
);
assert.equal(storage.values.size, 0);
assert.equal(normalizeSmartAudioDid("+1 (919) 991-2389"), "+19199912389");

storage.setItem("dCloudLabAccess", "{not-json");
assert.equal(readDCloudAccess(storage, start), null);
assert.equal(storage.values.size, 0);

const blockedStorage = {
    getItem() {
        throw new Error("blocked");
    },
    removeItem() {
        throw new Error("blocked");
    },
    setItem() {
        throw new Error("blocked");
    }
};
globalThis.sessionStorage = new MemoryStorage();
assert.equal(
    saveDCloudAccess(
        "cb122.dc-01.com",
        "1168643",
        "9199912389",
        blockedStorage,
        start
    ),
    false
);
assert.deepEqual(getControlHubCredentials(blockedStorage, start + 1), {
    username: "cholland@cb122.dc-01.com",
    password: "dCloud8643!"
});
clearDCloudAccess(blockedStorage);
assert.equal(globalThis.sessionStorage.values.size, 0);
delete globalThis.sessionStorage;

console.log("dCloud storage tests passed.");
