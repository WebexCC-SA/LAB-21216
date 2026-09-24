# Overview

## Learning Objectives

The Desk Phone 9800 series is designed for the modern office and optimized for IT and facility’s needs.

The Desk Phone 9800 series is uniquely positioned as the most cost-effective solution for workstations at scale. With expanded functionality, the 9800 Series combines secure enterprise calling, meetings, desk reservations, and emergency calls all in one device. 

This lab will walk you through the setup, customization and management of the Desk Phone 9800 series when deployed with Webex Calling.

## Disclaimer

Although the lab design and configuration examples could be used as a reference, for design related questions please contact your representative at Cisco, or a Cisco partner.

## Lab Access

This lab uses your Cisco dCloud session details to populate the credentials you will use to access Collaboration Control Hub. These credentials will be populated automatically in the lab instructions so it is important that you complete this step.

1. Open your dCloud session and select the **Info** tab.

    ![alt text](assets/image-7.png)

2. In the fly-out panel, expand **Session Information** and find your **Session Id**.

    <div class="lab-access-inline-entry">
      <div class="lab-access-field">
        <label for="dCloudSessionId">Enter your dCloud session ID</label>
        <input
          type="text"
          id="dCloudSessionId"
          name="dCloudSessionId"
          form="info"
          inputmode="numeric"
          pattern="[0-9]{4,20}"
          placeholder="1168643"
          maxlength="20"
          autocomplete="off"
          required
        >
        <span class="lab-access-field-hint">Use the numeric Session Id shown in dCloud.</span>
      </div>
    </div>

    ![The Session Information section of the dCloud Info panel with the session ID highlighted](./assets/ch-access/docx-image-002.png){ width="700" }


3. In the same fly-out panel, expand **DNS**. Copy the domain beginning with `cb` from one of the DNS names. For example, copy `cb122.dc-01.com` from `mail1.cb122.dc-01.com`.

    <div class="lab-access-inline-entry">
      <div class="lab-access-field">
        <label for="dCloudDomain">Enter your dCloud domain</label>
        <input
          type="text"
          id="dCloudDomain"
          name="dCloudDomain"
          form="info"
          placeholder="cb122.dc-01.com"
          autocomplete="off"
          maxlength="253"
          required
        >
        <span class="lab-access-field-hint">Example: cb122.dc-01.com</span>
      </div>
    </div>

    ![The DNS section of the dCloud Info panel with the session domain highlighted](./assets/ch-access/docx-image-001.png){ width="700" }

4. In the same fly-out panel, expand **Phone Numbers**. Find the entry whose **Description** is **Smart Audio** and copy its **External (DID)** number to enter below.

    <div class="lab-access-inline-entry">
      <div class="lab-access-field">
        <label for="smartAudioDid">Enter the Smart Audio external DID</label>
        <input
          type="tel"
          id="smartAudioDid"
          name="smartAudioDid"
          form="info"
          inputmode="tel"
          pattern="[+0-9() .-]{7,25}"
          placeholder="919-991-2389"
          maxlength="25"
          autocomplete="off"
          required
        >
        <span class="lab-access-field-hint">Use the External (DID) number whose Description is Smart Audio.</span>
      </div>
    </div>

    ![The Phone Numbers section showing the Smart Audio external DID](assets/ch-access/smart-audio-phone-numbers.png){ width="700" }

5. Review the session details you entered above. To correct a value, return to its step and update the entry. The completed values will be available throughout the other lab sections.

<section class="lab-access-card lab-access-nested" aria-labelledby="dcloud-access-heading">
  <div class="lab-access-card-header">
    <span class="lab-access-step">Session details</span>
    <h3 id="dcloud-access-heading">Review your lab details</h3>
    <p>Your entries are saved automatically after all three values are valid.</p>
  </div>

  <form id="info" class="lab-access-form" onsubmit="setValues(event)">
    <dl class="lab-access-summary">
      <div>
        <dt>dCloud session ID</dt>
        <dd id="dcloud-summary-session-id">Not entered</dd>
      </div>
      <div>
        <dt>dCloud domain</dt>
        <dd id="dcloud-summary-domain">Not entered</dd>
      </div>
      <div>
        <dt>Smart Audio external DID</dt>
        <dd id="dcloud-summary-smart-audio-did">Not entered</dd>
      </div>
    </dl>

    <div class="lab-access-actions">
      <button type="button" id="dcloud-clear-saved" class="lab-access-button lab-access-button-secondary">Clear saved values</button>
    </div>
    <p id="dcloud-form-error" class="lab-access-status" role="status" aria-live="polite"></p>
  </form>
</section>

<div class="lab-access-nested" markdown>

Your dCloud domain, session ID, and Smart Audio DID are stored in this browser
for up to 12 hours, including across browser restarts. Clear the saved values
when using a shared browser.

Your Control Hub credentials:

- Username: <copy><w class="ControlHubUsername">Enter your dCloud details above</w></copy>
- Password: <copy><w class="ControlHubPassword">Enter your dCloud details above</w></copy>

The username is `cholland@` followed by your dCloud domain. The password is `dCloud`, followed by the last four digits of your session ID, followed by `!`.

</div>

6. Open the [Webex for Developers Getting Started page](https://developer.webex.com/messaging/docs/getting-started){ target="_blank" rel="noopener noreferrer" }. Select **Log in** at the top right and use the Control Hub credentials shown above.

    ![alt text](assets/image-14.png)

7. After logging in, click on the profile picture of Charles Holland on the top right corner of the screen and copy the bearer token. Click OK on the Copy Token popup. 

    ![alt text](assets/image-22.png)

8. Enter your copied bearer token below. You can use it during various lab modules for up to 12 hours.

<section id="webex-access-card" class="lab-access-card lab-access-nested" aria-labelledby="webex-access-heading">
  <div class="lab-access-card-header">
    <span class="lab-access-step">Webex API access</span>
    <h3 id="webex-access-heading">Bearer token</h3>
    <p>Paste the temporary sandbox token from Webex for Developers. It is saved in this browser for up to 12 hours so it remains available after refreshes, direct navigation, and browser restarts.</p>
  </div>

  <div class="lab-access-field">
    <label for="webex-admin-token">Webex bearer token</label>
    <div class="lab-access-token-row">
      <input id="webex-admin-token" type="password" autocomplete="off" spellcheck="false" maxlength="8192" placeholder="Paste the bearer token">
      <button id="webex-token-toggle" type="button" class="lab-access-button lab-access-button-secondary" aria-pressed="false">Show</button>
    </div>
    <span class="lab-access-field-hint">Required administrator access includes people, devices, one-time activation codes, and supported remote phone actions.</span>
  </div>

  <div class="lab-access-actions">
    <button id="webex-token-save" type="button" class="lab-access-button lab-access-button-primary">Save token for 12 hours</button>
    <button id="webex-token-clear" type="button" class="lab-access-button lab-access-button-secondary">Clear token</button>
  </div>
  <p id="webex-token-status" class="lab-access-status" role="status" aria-live="polite"></p>
</section>

<div class="lab-access-nested" markdown>

The dCloud details, Smart Audio DID, derived Control Hub credentials, and
sandbox bearer token remain available in this browser for up to 12 hours.
Select **Clear saved values** before leaving a shared computer to remove all
saved Lab Access values.

</div>
