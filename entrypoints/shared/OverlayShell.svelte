<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  type OverlayChoice = 'yes' | 'no';
  type OverlayPhase = 'ready' | 'downloading' | 'pending' | 'processing' | 'error';
  type OverlayEventDetail = {
    byteLength?: number;
    error?: string;
    generation?: number;
    assetLabel?: string;
    fileFormat?: string;
  };

  export let eventPrefix = 'meshy-downloader';
  export let assetLabel = 'model';
  export let fileFormat = 'GLB';
  export let autoHideDelay = 5000;

  let visible = false;
  let leaving = false;
  let phase: OverlayPhase = 'ready';
  let lastAssetSize: number | undefined;
  let hideTimer: number | undefined;
  let leaveTimer: number | undefined;
  let visibleGeneration: number | undefined;
  let currentAssetLabel: string | undefined;
  let currentFileFormat: string | undefined;
  let errorMessage: string | undefined;

  const EXIT_DURATION = 260;

  $: events = {
    modelChanged: `${eventPrefix}:model-changed`,
    assetReady: `${eventPrefix}:glb-ready`,
    downloadPending: `${eventPrefix}:download-pending`,
    downloadProcessing: `${eventPrefix}:download-processing`,
    downloadStarted: `${eventPrefix}:download-started`,
    downloadError: `${eventPrefix}:download-error`,
    userChoice: `${eventPrefix}:user-choice`,
  };

  $: normalizedAssetLabel = (currentAssetLabel ?? assetLabel).trim() || 'asset';
  $: normalizedFileFormat = (currentFileFormat ?? fileFormat).trim() || 'file';
  $: hasAssetSize = lastAssetSize != null;
  $: assetSizeText = hasAssetSize ? `${(lastAssetSize / 1024 / 1024).toFixed(2)} MB` : 'unknown';

  function emitChoice(choice: OverlayChoice) {
    window.dispatchEvent(new CustomEvent(events.userChoice, { detail: choice }));
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
    console.debug('[Downloader Overlay] Scheduling auto-hide in', autoHideDelay, 'ms');
    hideTimer = window.setTimeout(() => {
      console.debug('[Downloader Overlay] Auto-hiding overlay');
      hideTimer = undefined;
      hideOverlay();
    }, autoHideDelay);
  }

  function download() {
    clearHideTimer();
    emitChoice('yes');
  }

  function close() {
    hideOverlay();
    emitChoice('no');
  }

  function onModelChanged(event: Event) {
    const generation = (event as CustomEvent<OverlayEventDetail>).detail.generation;
    if (generation == null) return;
    if (visibleGeneration == null || generation <= visibleGeneration) return;
    scheduleAutoHide();
  }

  function onAssetReady(event: Event) {
    const detail = (event as CustomEvent<OverlayEventDetail>).detail;
    lastAssetSize = detail.byteLength;
    visibleGeneration = detail.generation;
    currentAssetLabel = detail.assetLabel ?? currentAssetLabel;
    currentFileFormat = detail.fileFormat ?? currentFileFormat;
    errorMessage = undefined;
    phase = 'ready';
    clearLeaveTimer();
    leaving = false;
    visible = true;
    scheduleAutoHide();
  }

  function onDownloadPending() {
    phase = 'pending';
    errorMessage = undefined;
    clearHideTimer();
    clearLeaveTimer();
    leaving = false;
    visible = true;
  }

  function onDownloadStarted(event: Event) {
    const detail = (event as CustomEvent<OverlayEventDetail>).detail;
    lastAssetSize = detail.byteLength ?? lastAssetSize;
    phase = 'downloading';
    errorMessage = undefined;
    clearLeaveTimer();
    leaving = false;
    visible = true;
    scheduleAutoHide();
  }

  function onDownloadProcessing() {
    phase = 'processing';
    errorMessage = undefined;
    clearHideTimer();
    clearLeaveTimer();
    leaving = false;
    visible = true;
  }

  function onDownloadError(event: Event) {
    const detail = (event as CustomEvent<OverlayEventDetail>).detail;
    phase = 'error';
    errorMessage = detail.error ?? 'Download failed.';
    clearLeaveTimer();
    leaving = false;
    visible = true;
  }

  onMount(() => {
    window.addEventListener(events.modelChanged, onModelChanged);
    window.addEventListener(events.assetReady, onAssetReady);
    window.addEventListener(events.downloadPending, onDownloadPending);
    window.addEventListener(events.downloadProcessing, onDownloadProcessing);
    window.addEventListener(events.downloadStarted, onDownloadStarted);
    window.addEventListener(events.downloadError, onDownloadError);
  });

  onDestroy(() => {
    clearHideTimer();
    clearLeaveTimer();
    window.removeEventListener(events.modelChanged, onModelChanged);
    window.removeEventListener(events.assetReady, onAssetReady);
    window.removeEventListener(events.downloadPending, onDownloadPending);
    window.removeEventListener(events.downloadProcessing, onDownloadProcessing);
    window.removeEventListener(events.downloadStarted, onDownloadStarted);
    window.removeEventListener(events.downloadError, onDownloadError);
  });
</script>

{#if visible}
  {#key lastAssetSize}
    <div class="box" class:leaving role="dialog" aria-live="polite">
      <button class="x" aria-label="Close" on:click={close}>×</button>

      {#if phase === 'ready'}
        <slot
          name="ready"
          assetLabel={normalizedAssetLabel}
          fileFormat={normalizedFileFormat}
          assetSizeText={assetSizeText}
          hasAssetSize={hasAssetSize}
          download={download}
          close={close}
        />
      {:else if phase === 'pending'}
        <slot
          name="pending"
          assetLabel={normalizedAssetLabel}
          fileFormat={normalizedFileFormat}
          close={close}
        />
      {:else if phase === 'processing'}
        <slot
          name="processing"
          assetLabel={normalizedAssetLabel}
          fileFormat={normalizedFileFormat}
        />
      {:else if phase === 'downloading'}
        <slot
          name="downloading"
          assetLabel={normalizedAssetLabel}
          fileFormat={normalizedFileFormat}
          assetSizeText={assetSizeText}
          hasAssetSize={hasAssetSize}
        />
      {:else if phase === 'error'}
        <slot
          name="error"
          assetLabel={normalizedAssetLabel}
          fileFormat={normalizedFileFormat}
          errorMessage={errorMessage}
          close={close}
        />
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

  .box :global(h2) {
    margin: 0 34px 8px 0;
    font-size: 16px;
    line-height: 1.25;
  }

  .box :global(p) {
    margin: 0 0 12px;
    color: #c9c9cf;
    line-height: 1.4;
    font-size: 13px;
  }

  .box :global(.actions) {
    display: grid;
    gap: 8px;
  }

  .box :global(button) {
    border: 0;
    border-radius: 10px;
    padding: 9px 10px;
    font-weight: 700;
    cursor: pointer;
    background: #ffffff;
    color: #111116;
  }

  .box :global(.secondary) {
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
