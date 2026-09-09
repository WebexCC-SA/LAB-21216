"use strict";

const assert = require("node:assert/strict");

const {
    clearToken,
    getToken,
    normalizeToken,
    storeToken
} = require("../docs/template_assets/js/webexAccess.js");

const token = "abcdefghijklmnopqrstuvwxyz0123456789";

assert.equal(normalizeToken(`  Bearer ${token}  `), token);
assert.equal(storeToken(`Bearer ${token}`), true);
assert.equal(getToken(), token);

assert.equal(storeToken("too-short"), false);
assert.equal(getToken(), token);

clearToken();
assert.equal(getToken(), "");

console.log("Webex Lab Access token tests passed.");
