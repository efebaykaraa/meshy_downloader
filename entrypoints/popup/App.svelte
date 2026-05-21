<script lang="ts">
  import { browser } from '#imports';
  import { onMount } from 'svelte';
  import type { HelperState, TabState } from '../../src/lib/types';

  let tabState: TabState | null = null;
  let helperState: HelperState | null = null;
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
    [tabState, helperState] = await Promise.all([
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
      message = `Download started (${(result.byteLength / 1024 / 1024).toFixed(2)} MB).`;
    } else {
      message = result?.error ?? 'No decoded model is currently buffered. Click/open a model first.';
    }
    await refresh();
  }

  async function neverShowAgain() {
    helperState = await browser.runtime.sendMessage({ type: 'set-never-show-again', value: true });
    message = 'Overlay disabled.';
  }

  async function enableAgain() {
    helperState = await browser.runtime.sendMessage({ type: 'reset-state' });
    message = 'Overlay restored.';
  }

  onMount(refresh);
</script>

<main>
  <h1>Meshy Helper</h1>

  {#if loading}
    <p>Checking current tab...</p>
  {:else if tabState?.shouldRedirect}
    <p>You are not on Meshy.</p>
    <button on:click={openWorkspace}>Go to Meshy workspace</button>
  {:else}
    <p class="good">You are on Meshy.</p>

    {#if tabState?.page?.hasAuth}
      <section class="card">
        <h2>Auth captured</h2>
        <div class="row"><span>Host</span><code>{tabState.page.lastAuth?.hostname}</code></div>
        <div class="row"><span>Timestamp</span><code>{tabState.page.lastAuth?.timestamp}</code></div>
        <div class="row"><span>Signature</span><code>{maskSignature(tabState.page.lastAuth?.signature)}</code></div>
      </section>
    {:else if helperState?.lastAuth}
      <section class="card muted-card">
        <h2>Last stored auth</h2>
        <p>The current tab has not captured a fresh call yet. Click a model in the workspace.</p>
        <div class="row"><span>Host</span><code>{helperState.lastAuth.hostname}</code></div>
        <div class="row"><span>Time</span><code>{formatTime(helperState.lastAuth.capturedAt)}</code></div>
        <div class="row"><span>Signature</span><code>{maskSignature(helperState.lastAuth.signature)}</code></div>
      </section>
    {:else}
      <p class="hint">No auth call captured yet. Click a model in the workspace; that triggers the loader worker authorization call.</p>
    {/if}

    {#if tabState?.page?.hasDecodedGlb}
      <button on:click={downloadActiveTabMesh}>Download buffered GLB</button>
      <p class="hint">Buffered size: {((tabState.page.lastGlbSize ?? 0) / 1024 / 1024).toFixed(2)} MB</p>
    {:else if tabState?.page?.pendingDownload}
      <p class="hint">Waiting for worker decode result. Tiny goblin is chewing.</p>
    {:else}
      <button class="secondary" on:click={downloadActiveTabMesh}>Try downloading active model</button>
    {/if}

    <button class="secondary" on:click={openWorkspace}>Open workspace</button>
  {/if}

  <hr />

  {#if helperState?.neverShowAgain}
    <button class="secondary" on:click={enableAgain}>Enable auto-popup</button>
  {:else}
    <button class="secondary" on:click={neverShowAgain}>Disable auto-popup</button>
  {/if}

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

  .hint, .muted {
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
</style>
