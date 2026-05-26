<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  let visible = false;
  let leaving = false;
  let phase: 'ready' | 'downloading' | 'pending' = 'ready';
  let lastGlbSize: number | undefined;
  let hideTimer: number | undefined;
  let leaveTimer: number | undefined;
  let visibleGeneration: number | undefined;
  
  const AUTO_HIDE_DELAY = 5000;
  const EXIT_DURATION = 260;

  function emitChoice(choice: 'yes' | 'no') {
    window.dispatchEvent(new CustomEvent('meshy-downloader:user-choice', { detail: choice }));
  }

  function clearHideTimer() {
    if (hideTimer == null) return;
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
  }

  function clearLeaveTimer() {
    if (leaveTimer == null) return;
    window.clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }

  function hideOverlay() {
    if (!visible || leaving) return;
    clearHideTimer();
    clearLeaveTimer();
    leaving = true;
    leaveTimer = window.setTimeout(() => {
      visible = false;
      leaving = false;
      visibleGeneration = undefined;
      leaveTimer = undefined;
    }, EXIT_DURATION);
  }

  function scheduleAutoHide() {
    clearHideTimer();
    console.debug('[Meshy Downloader] Scheduling auto-hide in', AUTO_HIDE_DELAY, 'ms');
    hideTimer = window.setTimeout(() => {
      console.debug('[Meshy Downloader] Auto-hiding overlay');
      hideTimer = undefined;
      hideOverlay();
    }, AUTO_HIDE_DELAY);
  }

  function yes() {
    clearHideTimer();
    emitChoice('yes');
  }

  function no() {
    hideOverlay();
    emitChoice('no');
  }

  function onModelChanged(event: Event) {
    const generation = (event as CustomEvent<{ generation?: number }>).detail.generation;
    if (generation == null) return;
    if (visibleGeneration == null || generation <= visibleGeneration) return;
    
    scheduleAutoHide();
  }

  function onGlbReady(event: Event) {
    const detail = (event as CustomEvent<{ byteLength: number; generation?: number }>).detail;
    lastGlbSize = detail.byteLength;
    visibleGeneration = detail.generation;
    phase = 'ready';
    clearLeaveTimer();
    leaving = false;
    visible = true;
    scheduleAutoHide();
  }

  function onDownloadPending(event: Event) {
    phase = 'pending';
    clearHideTimer();
    clearLeaveTimer();
    leaving = false;
    visible = true;
    // Don't auto-hide while pending — the user is waiting for their download
  }

  function onDownloadStarted(event: Event) {
    phase = 'downloading';
    clearLeaveTimer();
    leaving = false;
    visible = true;
    scheduleAutoHide();
  }

  onMount(() => {
    window.addEventListener('meshy-downloader:model-changed', onModelChanged);
    window.addEventListener('meshy-downloader:glb-ready', onGlbReady);
    window.addEventListener('meshy-downloader:download-pending', onDownloadPending);
    window.addEventListener('meshy-downloader:download-started', onDownloadStarted);
  });

  onDestroy(() => {
    clearHideTimer();
    clearLeaveTimer();
    window.removeEventListener('meshy-downloader:model-changed', onModelChanged);
    window.removeEventListener('meshy-downloader:glb-ready', onGlbReady);
    window.removeEventListener('meshy-downloader:download-pending', onDownloadPending);
    window.removeEventListener('meshy-downloader:download-started', onDownloadStarted);
  });
</script>

{#if visible}
  {#key lastGlbSize}
    <div class="box" class:leaving role="dialog" aria-live="polite">
      <button class="x" aria-label="Close" on:click={no}>×</button>

      {#if phase === 'ready'}
        <h2>GLB decoded</h2>
        <p>The model is ready in memory{lastGlbSize ? ` (${(lastGlbSize / 1024 / 1024).toFixed(2)} MB)` : ''}.</p>
        <div class="actions">
          <button on:click={yes}>Download now</button>
          <button class="secondary" on:click={no}>Close</button>
        </div>
      {:else if phase === 'pending'}
        <h2>Waiting for decode…</h2>
        <p>Download will start automatically once the model is ready.</p>
        <div class="actions">
          <button class="secondary" on:click={no}>Cancel</button>
        </div>
      {:else if phase === 'downloading'}
        <h2>Download started</h2>
        <p>GLB size: {lastGlbSize ? `${(lastGlbSize / 1024 / 1024).toFixed(2)} MB` : 'unknown'}.</p>
      {/if}
    </div>
  {/key}
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
    animation: slide-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
    will-change: transform, opacity;
  }

  .box.leaving {
    animation: slide-out 260ms cubic-bezier(0.7, 0, 0.84, 0) both;
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

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translate3d(420px, 0, 0) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @keyframes slide-out {
    from {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }

    to {
      opacity: 0;
      transform: translate3d(420px, 0, 0) scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .box,
    .box.leaving {
      animation-duration: 1ms;
    }
  }
</style>
