<script lang="ts">
  import { Label, Fileupload } from "flowbite-svelte";

  let files: FileList | undefined = undefined;
  let elementRef: HTMLInputElement;
</script>

<Label class="pb-2">Upload file</Label>
<Fileupload 
  bind:files
  bind:elementRef
  size="md"
  clearable={true}
/>
