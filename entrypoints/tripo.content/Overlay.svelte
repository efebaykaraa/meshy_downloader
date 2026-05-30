<script lang="ts">
  import OverlayShell from '../shared/OverlayShell.svelte';

  export let eventPrefix = 'meshy-downloader';
  export let assetLabel = 'Tripo3D model';
  export let fileFormat = 'GLB';
  export let autoHideDelay = 5000;
</script>

<OverlayShell {eventPrefix} {assetLabel} {fileFormat} {autoHideDelay}>
  <svelte:fragment slot="ready" let:assetLabel let:fileFormat let:download let:close>
    <h2>{assetLabel} detected</h2>
    <p>The active {fileFormat} URL is ready. Downloading will create a cleaned GLB.</p>
    <div class="actions">
      <button on:click={download}>Download now</button>
      <button class="secondary" on:click={close}>Close</button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="pending" let:assetLabel let:close>
    <h2>Waiting for model…</h2>
    <p>Download will start once the active {assetLabel} URL is detected.</p>
    <div class="actions">
      <button class="secondary" on:click={close}>Cancel</button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="processing" let:assetLabel>
    <h2>Processing {assetLabel}…</h2>
    <p>Decompressing and dequantizing the GLB.</p>
  </svelte:fragment>

  <svelte:fragment slot="downloading" let:fileFormat let:assetSizeText let:hasAssetSize>
    <h2>Download started</h2>
    <p>{fileFormat} size: {assetSizeText}.</p>
  </svelte:fragment>

  <svelte:fragment slot="error" let:errorMessage let:close>
    <h2>Tripo3D download failed</h2>
    <p>{errorMessage}</p>
    <div class="actions">
      <button class="secondary" on:click={close}>Close</button>
    </div>
  </svelte:fragment>
</OverlayShell>
