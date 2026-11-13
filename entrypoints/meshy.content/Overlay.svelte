<script lang="ts">
  import OverlayShell from '../shared/OverlayShell.svelte';

  export let eventPrefix = '3d-downloader';
  export let assetLabel = 'model';
  export let fileFormat = 'GLB';
  export let autoHideDelay = 5000;
</script>

<OverlayShell {eventPrefix} {assetLabel} {fileFormat} {autoHideDelay}>
  <svelte:fragment
    slot="ready"
    let:assetLabel
    let:fileFormat
    let:assetSizeText
    let:hasAssetSize
    let:download
    let:close
  >
    <h2>{fileFormat} decoded</h2>
    <p>The {assetLabel} is ready in memory{hasAssetSize ? ` (${assetSizeText})` : ''}.</p>
    <div class="actions">
      <button on:click={download}>Download now</button>
      <button class="secondary" on:click={close}>Close</button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="pending" let:assetLabel let:close>
    <h2>Waiting for decode…</h2>
    <p>Download will start automatically once the {assetLabel} is ready.</p>
    <div class="actions">
      <button class="secondary" on:click={close}>Cancel</button>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="processing" let:assetLabel let:fileFormat>
    <h2>Processing {assetLabel}…</h2>
    <p>Preparing a cleaned {fileFormat} for download.</p>
  </svelte:fragment>

  <svelte:fragment slot="downloading" let:fileFormat let:assetSizeText>
    <h2>Download started</h2>
    <p>{fileFormat} size: {assetSizeText}.</p>
  </svelte:fragment>

  <svelte:fragment slot="error" let:errorMessage let:close>
    <h2>Download failed</h2>
    <p>{errorMessage}</p>
    <div class="actions">
      <button class="secondary" on:click={close}>Close</button>
    </div>
  </svelte:fragment>
</OverlayShell>
