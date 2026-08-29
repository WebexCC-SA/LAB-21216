"use strict";

const assert = require("node:assert/strict");
const {
    ALLOWED_MODELS,
    buildOnboardingUrl,
    callingPeople,
    formatActivationCode,
    responseData
} = require("../docs/template_assets/js/devicefxActivation.js");
const qrcode = require(
    "../docs/template_assets/js/vendor/qrcode-generator-2.0.4.js"
);

async function run() {
    assert.equal(
        formatActivationCode("1122334455667788"),
        "1122-3344-5566-7788"
    );
    assert.equal(
        formatActivationCode("1122-3344-5566-7788"),
        "1122-3344-5566-7788"
    );
    assert.throws(
        () => formatActivationCode("1122-3344"),
        /invalid activation code/
    );

    const onboardingUrl = new URL(
        buildOnboardingUrl("1122-3344-5566-7788")
    );
    assert.equal(onboardingUrl.origin, "https://nfc.devicefx.com");
    assert.equal(onboardingUrl.pathname, "/onboarding");
    assert.equal(
        onboardingUrl.searchParams.get("activation-code"),
        "1122-3344-5566-7788"
    );

    const people = callingPeople([
        {
            id: "person-z",
            displayName: "Zara Example",
            locationId: "location-1",
            emails: ["zara@example.com"]
        },
        {
            id: "person-c",
            displayName: "Charles Holland",
            extension: "1001",
            emails: ["charles@example.com"]
        },
        {
            id: "person-no-calling",
            displayName: "No Calling License"
        },
        {
            id: "",
            displayName: "Invalid"
        }
    ]);
    assert.deepEqual(
        people.map((person) => person.displayName),
        ["Charles Holland", "Zara Example"]
    );
    assert.equal(people[0].email, "charles@example.com");
    assert.throws(() => callingPeople({}), /invalid people list/);

    assert(ALLOWED_MODELS.has("Cisco 9871"));
    assert(ALLOWED_MODELS.has("Cisco 9861"));
    assert(!ALLOWED_MODELS.has("Cisco 8851"));

    const success = new Response(
        JSON.stringify({ code: "1122334455667788" }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
    assert.deepEqual(
        await responseData(success),
        { code: "1122334455667788" }
    );

    for (const [status, message] of [
        [401, /invalid or expired/],
        [403, /required Webex administrator scopes/],
        [429, /rate limiting/]
    ]) {
        const response = new Response(JSON.stringify({ message: "hidden" }), {
            status,
            headers: { "Content-Type": "application/json" }
        });
        await assert.rejects(responseData(response), message);
    }

    const unexpected = new Response("<html></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" }
    });
    await assert.rejects(
        responseData(unexpected),
        /unexpected response format/
    );
    const invalidJson = new Response("{", {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
    await assert.rejects(responseData(invalidJson), /invalid JSON/);

    const qr = qrcode(0, "M");
    qr.addData(onboardingUrl.href);
    qr.make();
    assert(qr.getModuleCount() > 0);
    assert.equal(typeof qr.isDark(0, 0), "boolean");

    console.log("DeviceFX activation tests passed.");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
