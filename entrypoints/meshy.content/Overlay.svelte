<script lang="ts">
  import { browser } from '#imports';
  import { onDestroy, onMount } from 'svelte';
  import type { MeshyAuthPayload } from '../../src/lib/types';

  let visible = false;
  let neverShowAgain = false;
  let phase: 'auth' | 'waiting' | 'ready' | 'downloading' | 'saved' = 'auth';
  let lastAuth: MeshyAuthPayload | undefined;
  let lastGlbSize: number | undefined;

  function maskSignature(signature: string) {
    if (signature.length <= 10) return signature;
    return `${signature.slice(0, 6)}…${signature.slice(-4)}`;
  }

  function emitChoice(choice: 'yes' | 'no' | 'never') {
    window.dispatchEvent(new CustomEvent('meshy-helper:user-choice', { detail: choice }));
  }

  function yes() {
    phase = 'waiting';
    emitChoice('yes');
  }

  function no() {
    visible = false;
    emitChoice('no');
  }

  function never() {
    visible = false;
    neverShowAgain = true;
    emitChoice('never');
  }

  function onAuth(event: Event) {
    if (neverShowAgain) return;
    lastAuth = (event as CustomEvent<MeshyAuthPayload>).detail;
    lastGlbSize = undefined;
    phase = 'auth';
    visible = true;
  }

  function onWaiting() {
    phase = 'waiting';
    visible = true;
  }

  function onGlbReady(event: Event) {
    lastGlbSize = (event as CustomEvent<{ byteLength: number }>).detail.byteLength;
    if (phase === 'waiting') return;
    phase = 'ready';
  }

  function onDownloadStarted(event: Event) {
    lastGlbSize = (event as CustomEvent<{ byteLength: number }>).detail.byteLength;
    phase = 'downloading';
    visible = true;
    setTimeout(() => {
      if (phase === 'downloading') visible = false;
    }, 2200);
  }

  function onPreferenceSaved() {
    phase = 'saved';
    visible = true;
    setTimeout(() => (visible = false), 1600);
  }

  onMount(async () => {
    const state = await browser.runtime.sendMessage({ type: 'get-state' });
    neverShowAgain = Boolean(state?.neverShowAgain);

    window.addEventListener('meshy-helper:auth-captured', onAuth);
    window.addEventListener('meshy-helper:waiting-for-glb', onWaiting);
    window.addEventListener('meshy-helper:glb-ready', onGlbReady);
    window.addEventListener('meshy-helper:download-started', onDownloadStarted);
    window.addEventListener('meshy-helper:preference-saved', onPreferenceSaved);
  });

  onDestroy(() => {
    window.removeEventListener('meshy-helper:auth-captured', onAuth);
    window.removeEventListener('meshy-helper:waiting-for-glb', onWaiting);
    window.removeEventListener('meshy-helper:glb-ready', onGlbReady);
    window.removeEventListener('meshy-helper:download-started', onDownloadStarted);
    window.removeEventListener('meshy-helper:preference-saved', onPreferenceSaved);
  });
</script>

{#if visible}
  <div class="box" role="dialog" aria-live="polite">
    <button class="x" aria-label="Close" on:click={no}>×</button>

    {#if phase === 'auth'}
      <h2>Would you like to download the mesh?</h2>
      <p>The Meshy auth call was captured. Choose <strong>Yes</strong> to download the decoded GLB when the worker finishes processing.</p>
      {#if lastAuth}
        <div class="meta">
          <div><span>Host</span><code>{lastAuth.hostname}</code></div>
          <div><span>Timestamp</span><code>{lastAuth.timestamp}</code></div>
          <div><span>Signature</span><code>{maskSignature(lastAuth.signature)}</code></div>
        </div>
      {/if}
      <div class="actions">
        <button on:click={yes}>Yes</button>
        <button class="secondary" on:click={no}>No</button>
        <button class="ghost" on:click={never}>Never show again</button>
      </div>
    {:else if phase === 'waiting'}
      <h2>Waiting for decoded GLB…</h2>
      <p>The next successful worker <code>process</code> result will be saved as a <code>.glb</code> file.</p>
      <button class="secondary" on:click={no}>Cancel</button>
    {:else if phase === 'ready'}
      <h2>GLB decoded</h2>
      <p>The model is ready in memory{lastGlbSize ? ` (${(lastGlbSize / 1024 / 1024).toFixed(2)} MB)` : ''}.</p>
      <div class="actions">
        <button on:click={yes}>Download now</button>
        <button class="secondary" on:click={no}>Close</button>
      </div>
    {:else if phase === 'downloading'}
      <h2>Download started</h2>
      <p>GLB size: {lastGlbSize ? `${(lastGlbSize / 1024 / 1024).toFixed(2)} MB` : 'unknown'}.</p>
    {:else if phase === 'saved'}
      <h2>Saved</h2>
      <p>The helper will not show the page overlay again.</p>
    {/if}
  </div>
{/if}

<style>
  .box {
    position: fixed;
    right: 18px;
    bottom: 18px;
    width: 360px;
    z-index: 2147483647;
    box-sizing: border-box;
    padding: 16px;
    border: 1px solid rgba(255,255,255,0.16);
    border-radius: 16px;
    background: rgba(18,18,22,0.97);
    color: #f7f7fa;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 20px 60px rgba(0,0,0,0.42);
  }

  .x {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 0;
    background: #2a2a31;
    color: white;
    cursor: pointer;
  }

  h2 {
    margin: 0 34px 8px 0;
    font-size: 16px;
    line-height: 1.25;
  }

  p {
    margin: 0 0 12px;
    color: #c9c9cf;
    line-height: 1.4;
    font-size: 13px;
  }

  strong, code {
    color: #ffffff;
  }

  .meta {
    display: grid;
    gap: 5px;
    margin: 0 0 12px;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    font-size: 12px;
  }

  .meta div {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 8px;
  }

  .meta span {
    color: #a9a9b2;
  }

  .meta code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: grid;
    gap: 8px;
  }

  button {
    border: 0;
    border-radius: 10px;
    padding: 9px 10px;
    font-weight: 700;
    cursor: pointer;
    background: #ffffff;
    color: #111116;
  }

  .secondary {
    background: #2a2a31;
    color: #ffffff;
  }

  .ghost {
    background: transparent;
    color: #c9c9cf;
  }
</style>
