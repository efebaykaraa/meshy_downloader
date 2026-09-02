<script lang="ts">
  import { browser } from '#imports';
  import { onMount } from 'svelte';
  import type { DownloaderState, TabState, TextureFormat } from '../../src/lib/types';

  let tabState: TabState | null = null;
  let downloaderState: DownloaderState | null = null;
  let loading = true;
  let message = '';

  function maskSignature(signature?: string) {
    if (!signature) return 'none';
    if (signature.length <= 10) return signature;
    return `${signature.slice(0, 6)}…${signature.slice(-4)}`;
  }

  function formatTime(timestamp?: number) {
    if (!timestamp) return 'never';
    return new Date(timestamp).toLocaleString();
  }

  async function refresh() {
    loading = true;
    [tabState, downloaderState] = await Promise.all([
      browser.runtime.sendMessage({ type: 'get-active-tab-state' }),
      browser.runtime.sendMessage({ type: 'get-state' }),
    ]);
    loading = false;
  }

  async function openWorkspace() {
    await browser.runtime.sendMessage({ type: 'open-workspace' });
    message = 'Opened Meshy workspace. Click a model to trigger the auth call.';
  }

  async function downloadActiveTabMesh() {
    const result = await browser.runtime.sendMessage({ type: 'download-active-tab-mesh' });
    if (result?.ok) {
      message = result.byteLength
        ? `Download started (${(result.byteLength / 1024 / 1024).toFixed(2)} MB).`
        : 'Download started.';
    } else {
      message = result?.error ?? 'No decoded model is currently buffered. Click/open a model first.';
    }
    await refresh();
  }

  async function setAutoAskToDownload(event: Event) {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    downloaderState = await browser.runtime.sendMessage({
      type: 'set-never-show-again',
      value: !enabled,
    });
    message = enabled ? 'Auto ask enabled.' : 'Auto ask disabled.';
  }

  async function setTextureFormat(event: Event) {
    const textureFormat = (event.currentTarget as HTMLSelectElement).value as TextureFormat;
    downloaderState = await browser.runtime.sendMessage({
      type: 'set-texture-format',
      value: textureFormat,
    });
    message = `Texture format set to ${textureFormat === 'default' ? 'default' : textureFormat.toUpperCase()}.`;
  }

  onMount(refresh);
</script>

<main>
  <h1>Meshy Downloader</h1>

  {#if loading}
    <p>Checking current tab...</p>
  {:else if tabState?.shouldRedirect}
    <p>You are not on Meshy.</p>
    <button on:click={openWorkspace}>Go to Meshy workspace</button>
  {:else}
    <p class="good">You are on {tabState?.currentWebsiteLabel ?? 'a supported website'}.</p>

    {#if tabState?.page?.hasAuth}
      <section class="card">
        <h2>Auth captured</h2>
        <div class="row"><span>Host</span><code>{tabState.page.lastAuth?.hostname}</code></div>
        <div class="row"><span>Timestamp</span><code>{tabState.page.lastAuth?.timestamp}</code></div>
        <div class="row"><span>Signature</span><code>{maskSignature(tabState.page.lastAuth?.signature)}</code></div>
      </section>
    {:else if downloaderState?.lastAuth}
      <section class="card muted-card">
        <h2>Last stored auth</h2>
        <p>The current tab has not captured a fresh call yet. Click a model in the workspace.</p>
        <div class="row"><span>Host</span><code>{downloaderState.lastAuth.hostname}</code></div>
        <div class="row"><span>Time</span><code>{formatTime(downloaderState.lastAuth.capturedAt)}</code></div>
        <div class="row"><span>Signature</span><code>{maskSignature(downloaderState.lastAuth.signature)}</code></div>
      </section>
    {:else}
      <p class="hint">No auth call captured yet. Click a model in the workspace; that triggers the loader worker authorization call.</p>
    {/if}

    {#if tabState?.page?.hasActiveModel ?? tabState?.page?.hasDecodedGlb}
      <button on:click={downloadActiveTabMesh}>Download active GLB</button>
      {#if tabState.page.lastGlbSize}
        <p class="hint">Buffered size: {(tabState.page.lastGlbSize / 1024 / 1024).toFixed(2)} MB</p>
      {:else}
        <p class="hint">Active model URL detected.</p>
      {/if}
    {:else if tabState?.page?.pendingDownload}
      <p class="hint">Waiting for worker decode result.</p>
    {:else}
      <button class="secondary" on:click={downloadActiveTabMesh}>Try downloading active model</button>
    {/if}

    <button class="secondary" on:click={openWorkspace}>Open workspace</button>
  {/if}

  <hr />

  <section class="settings" aria-label="Download settings">
    <label class="setting-row" for="texture-format">
      <span>Texture Format:</span>
      <select
        id="texture-format"
        value={downloaderState?.textureFormat ?? 'default'}
        on:change={setTextureFormat}
      >
        <option value="default">Default</option>
        <option value="webp">WEBP</option>
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
    </label>

    <label class="setting-row" for="auto-ask-to-download">
      <span>Auto Ask To Download:</span>
      <input
        id="auto-ask-to-download"
        class="switch-input"
        type="checkbox"
        role="switch"
        checked={!downloaderState?.neverShowAgain}
        on:change={setAutoAskToDownload}
      />
    </label>
  </section>

  <button class="ghost" on:click={refresh}>Refresh</button>

  {#if message}
    <p class="msg">{message}</p>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #111116;
    color: #f4f4f5;
  }

  main {
    width: 350px;
    padding: 16px;
    box-sizing: border-box;
  }

  h1 {
    margin: 0 0 12px;
    font-size: 18px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 14px;
  }

  p {
    line-height: 1.4;
    font-size: 13px;
  }

  .good {
    color: #9ee493;
  }

  .hint {
    color: #b8b8bd;
  }

  .msg {
    color: #9ee493;
  }

  .card {
    display: grid;
    gap: 6px;
    padding: 10px;
    border-radius: 12px;
    background: #1c1c24;
    margin: 10px 0;
  }

  .muted-card {
    background: #18181f;
  }

  .row {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: 8px;
    font-size: 12px;
  }

  .row span {
    color: #a6a6ae;
  }

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: white;
  }

  button {
    width: 100%;
    border: 0;
    border-radius: 10px;
    padding: 10px 12px;
    margin: 6px 0;
    background: #ffffff;
    color: #111116;
    cursor: pointer;
    font-weight: 700;
  }

  button.secondary {
    background: #2a2a31;
    color: #f4f4f5;
  }

  button.ghost {
    background: transparent;
    color: #b8b8bd;
  }

  hr {
    border: 0;
    border-top: 1px solid #2a2a31;
    margin: 14px 0;
  }

  .settings {
    display: grid;
    gap: 10px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 36px;
    font-size: 13px;
    font-weight: 600;
  }

  select {
    min-width: 112px;
    border: 1px solid #3a3a43;
    border-radius: 8px;
    padding: 7px 30px 7px 9px;
    background: #2a2a31;
    color: #f4f4f5;
    font: inherit;
    cursor: pointer;
  }

  .switch-input {
    width: 42px;
    height: 24px;
    margin: 0;
    appearance: none;
    border-radius: 999px;
    background: #3a3a43;
    cursor: pointer;
    position: relative;
    transition: background 160ms ease;
  }

  .switch-input::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform 160ms ease;
  }

  .switch-input:checked {
    background: #6c5ce7;
  }

  .switch-input:checked::after {
    transform: translateX(18px);
  }

  .switch-input:focus-visible,
  select:focus-visible {
    outline: 2px solid #a99df5;
    outline-offset: 2px;
  }
</style>
