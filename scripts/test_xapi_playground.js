"use strict";

const assert = require("node:assert/strict");
const {
    DEVICE_STORAGE_DURATION_MS,
    eligibleDevices,
    readSelectedDevice,
    saveSelectedDevice,
    setSetupReady,
    screenshotImage,
    screenshotRequest,
    webexErrorDetail
} = require("../docs/template_assets/js/xapiPlayground.js");

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

const devices = eligibleDevices([
    {
        id: "phone-9871",
        displayName: "Charles Phone",
        product: "Cisco Desk Phone 9871",
        connectionStatus: "connected",
        permissions: ["xapi"]
    },
    {
        id: "room-device",
        displayName: "Board",
        product: "Cisco Board Pro",
        permissions: ["xapi"]
    },
    {
        id: "phone-without-xapi",
        displayName: "Anita Phone",
        product: "Cisco 9861",
        permissions: ["read"]
    }
]);
assert.deepEqual(devices, [
    {
        id: "phone-9871",
        displayName: "Charles Phone",
        product: "Cisco Desk Phone 9871",
        connectionStatus: "connected"
    }
]);

assert.deepEqual(screenshotRequest("phone-9871"), {
    deviceId: "phone-9871"
});

const pngBytes = Buffer.alloc(128);
Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    .copy(pngBytes);
const screenshot = screenshotImage({
    result: { Image: pngBytes.toString("base64") }
});
assert.equal(screenshot.mime, "image/png");
assert.equal(screenshot.extension, "png");
assert.equal(screenshot.bytes.length, pngBytes.length);
assert.throws(
    () => screenshotImage({ result: { Image: "not-an-image" } }),
    /valid PNG or JPEG/
);

const storage = new MemoryStorage();
const start = Date.UTC(2026, 8, 9);
assert.equal(DEVICE_STORAGE_DURATION_MS, 12 * 60 * 60 * 1000);
assert.equal(
    saveSelectedDevice("phone-9871", storage, start),
    true
);
assert.equal(readSelectedDevice(storage, start + 1), "phone-9871");
assert.equal(
    readSelectedDevice(storage, start + DEVICE_STORAGE_DURATION_MS),
    ""
);
assert.equal(storage.values.size, 0);

assert.equal(
    webexErrorDetail({ message: "Command forbidden by policy" }),
    " Webex detail: Command forbidden by policy"
);

const setupAttribute = {};
const setupElements = {
    setupExpanded: false,
    setupOnly: [{ hidden: false }, { hidden: false }],
    setupToggle: {
        hidden: true,
        setAttribute: (name, value) => {
            setupAttribute[name] = value;
        },
        textContent: ""
    }
};
setSetupReady(setupElements, true);
assert.equal(setupElements.setupOnly.every((element) => element.hidden), true);
assert.equal(setupElements.setupToggle.hidden, false);
assert.equal(setupElements.setupToggle.textContent, "Setup details");
assert.equal(setupAttribute["aria-expanded"], "false");

console.log("Utilities tests passed.");
