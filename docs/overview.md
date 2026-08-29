# Overview

## Learning Objectives

This lab will walk you through the setup, customization and management of the Cisco Desk Phone 9800 series when deployed with Webex Calling.

## Disclaimer

Although the lab design and configuration examples could be used as a reference, for design related questions please contact your representative at Cisco, or a Cisco partner.

## Lab Access

This lab uses your Cisco dCloud session details to populate the credentials you will use to access Collaboration Control Hub. These credentials will be populated automatically in the lab instructions so it is important that you complete this step.

1. Open your dCloud session and select the **Info** tab.
2. In the fly-out panel, expand **DNS**. Copy the domain beginning with `cb` from one of the DNS names. For example, copy `cb122.dc-01.com` from `mail1.cb122.dc-01.com`.

    <figure markdown>
      ![The DNS section of the dCloud Info panel with the session domain highlighted](./assets/ch-access/docx-image-001.png){ width="700" }
    </figure>

3. In the same panel, expand **Session Information** and find your **Session Id**.

    <figure markdown>
      ![The Session Information section of the dCloud Info panel with the session ID highlighted](./assets/ch-access/docx-image-002.png){ width="700" }
    </figure>

4. Enter both values below and select **Update Lab Guide**.

<form id="info" onsubmit="setValues(event)">
  <label for="dCloudDomain">dCloud domain:</label>
  <input
    type="text"
    id="dCloudDomain"
    name="dCloudDomain"
    placeholder="cb122.dc-01.com"
    autocomplete="off"
    maxlength="253"
    required
  ><br>

  <label for="dCloudSessionId">dCloud session ID:</label>
  <input
    type="text"
    id="dCloudSessionId"
    name="dCloudSessionId"
    inputmode="numeric"
    pattern="[0-9]{4,20}"
    maxlength="20"
    autocomplete="off"
    required
  ><br>

  <button type="submit">Update Lab Guide</button>
  <p id="dcloud-form-error" role="alert" aria-live="polite"></p>
</form>

Your Control Hub credentials:

- Username: <copy><w class="ControlHubUsername">Enter your dCloud details above</w></copy>
- Password: <copy><w class="ControlHubPassword">Enter your dCloud details above</w></copy>

The username is `cholland@` followed by your dCloud domain. The password is `dCloud`, followed by the last four digits of your session ID, followed by `!`.
