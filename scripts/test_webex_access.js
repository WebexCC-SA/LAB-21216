"use strict";

const assert = require("node:assert/strict");

const {
    TOKEN_STORAGE_DURATION_MS,
    clearToken,
    getToken,
    isTokenPersisted,
    normalizeToken,
    readStoredToken,
    storeToken
} = require("../docs/template_assets/js/webexAccess.js");

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

const token = "abcdefghijklmnopqrstuvwxyz0123456789";
const start = Date.UTC(2026, 8, 9);
const storage = new MemoryStorage();

assert.equal(normalizeToken(`  Bearer ${token}  `), token);
assert.equal(TOKEN_STORAGE_DURATION_MS, 12 * 60 * 60 * 1000);
assert.equal(storeToken(`Bearer ${token}`, storage, start), true);
assert.equal(getToken(), token);
assert.equal(isTokenPersisted(), true);
assert.equal(readStoredToken(storage, start + 1), token);

assert.equal(storeToken("too-short", storage, start), false);
assert.equal(getToken(), token);

assert.equal(
    readStoredToken(storage, start + TOKEN_STORAGE_DURATION_MS),
    ""
);
assert.equal(storage.values.size, 0);

assert.equal(storeToken(token, storage, start), true);
clearToken(storage);
assert.equal(getToken(), "");
assert.equal(storage.values.size, 0);

storage.setItem("webexLabAccess", "{not-json");
assert.equal(readStoredToken(storage, start), "");
assert.equal(storage.values.size, 0);

console.log("Webex Lab Access token tests passed.");
