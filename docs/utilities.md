# Utilities

<div class="playground-setup-only" markdown>
Use these utilities to get information from or take actions on a Cisco Desk Phone 9800 Series device.

!!! info "Complete the lab prerequisites first"
    Before using Utilities, complete **Lab > Overview > Lab Access** and
    **Lab 1: Setup**. You need a saved sandbox bearer token and an online
    Webex-aware phone running PhoneOS 3.5 or later.
</div>

<section id="xapi-playground-app" class="xapi-playground-card" aria-labelledby="xapi-playground-heading">
  <div class="xapi-playground-header">
    <span class="lab-access-step">Phone utilities</span>
    <h2 id="xapi-playground-heading">Choose a phone</h2>
    <p>Select a compatible PhoneOS device, then choose an available utility.</p>
    <button id="playground-setup-toggle" type="button" class="xapi-button xapi-button-secondary" aria-expanded="false" hidden>Setup details</button>
  </div>

  <div class="xapi-prerequisites playground-setup-only" aria-label="Utilities prerequisites">
    <div class="xapi-prerequisite">
      <span>Bearer token</span>
      <strong id="xapi-token-prerequisite">Checking…</strong>
    </div>
    <div class="xapi-prerequisite">
      <span>Phone setup</span>
      <strong id="xapi-phone-prerequisite">Load devices to verify</strong>
    </div>
  </div>

  <div class="webex-inline-token lab-access-field playground-setup-only" data-webex-token-entry>
    <label for="xapi-token">Webex bearer token</label>
    <div class="lab-access-token-row">
      <input id="xapi-token" type="password" autocomplete="off" spellcheck="false" maxlength="8192" placeholder="Paste the sandbox bearer token" data-webex-token-input>
      <button type="button" class="lab-access-button lab-access-button-secondary" aria-pressed="false" data-webex-token-toggle>Show</button>
      <button type="button" class="lab-access-button lab-access-button-primary" data-webex-token-use>Save token</button>
    </div>
    <p class="lab-access-status" role="status" aria-live="polite" data-webex-token-status></p>
  </div>

  <div class="xapi-device-controls">
    <div class="xapi-field">
      <label for="xapi-device">Compatible PhoneOS device</label>
      <select id="xapi-device" disabled>
        <option value="">Load devices first</option>
      </select>
    </div>
    <button id="xapi-load-devices" type="button" class="xapi-button xapi-button-secondary">Load devices</button>
    <button id="xapi-clear-device" type="button" class="xapi-button xapi-button-secondary" disabled>Clear selection</button>
  </div>

  <p id="xapi-status" class="xapi-status" role="status" aria-live="polite"></p>

  <div class="xapi-action-grid">
    <article class="xapi-action-card">
      <h3>Get device screenshot</h3>
      <p>Capture the current phone display, preview it here, or download the PNG/JPEG file.</p>
      <button id="xapi-screenshot" type="button" class="xapi-button xapi-button-primary" disabled>Get screenshot</button>

      <section id="xapi-screenshot-result" class="xapi-result" aria-labelledby="xapi-screenshot-result-heading" hidden>
        <h4 id="xapi-screenshot-result-heading">Device screenshot</h4>
        <img id="xapi-screenshot-image" alt="Screenshot captured from the selected PhoneOS device">
        <a id="xapi-screenshot-download" class="xapi-button xapi-button-secondary" download="phone-screenshot.png">Download screenshot</a>
      </section>

      <details class="xapi-details">
        <summary>See how this works</summary>
        <pre><code id="xapi-screenshot-request"></code></pre>
      </details>
    </article>
  </div>
</section>

The expandable example never includes your bearer token. Screenshots remain in
browser memory unless you explicitly download them.
