<!-- SpreadsheetViewer.svelte -->
<script lang="ts">
  import { Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Fileupload } from 'flowbite-svelte';
  import * as XLSX from 'xlsx';

  let files = $state<FileList | undefined>(undefined);
  let elementRef = $state<HTMLInputElement | undefined>(undefined);
  let tableData = $state<any[]>([]);
  let headers = $state<string[]>([]);

  $effect(() => {
    if (!files?.[0]) {
      tableData = [];
      headers = [];
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const data = e.target?.result;
      const ext = file.name.toLowerCase().split('.').pop();
      const fileType = ext === 'csv' ? 'csv' : ext === 'xlsx' || ext === 'xls' ? 'excel' : null;
      
      if (!fileType || !data) {
        tableData = [];
        headers = [];
        return;
      }

      const workbook = XLSX.read(data, { 
        type: 'array',
        raw: fileType === 'csv'
      });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0] as object);
        tableData = jsonData;
      } else {
        headers = [];
        tableData = [];
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
</script>

<div class="p-4">
  <div class="mb-4">
    <Fileupload 
      bind:files
      bind:elementRef
      accept=".xlsx,.xls,.csv"
      size="md"
      clearable={true}
    />
    <p class="mt-1 text-sm text-gray-500">Supported formats: Excel (.xlsx, .xls) and CSV (.csv)</p>
  </div>

  {#if tableData.length > 0}
    <div class="overflow-x-auto">
      <Table striped={true}>
        <TableHead>
          {#each headers as header}
            <TableHeadCell>{header}</TableHeadCell>
          {/each}
        </TableHead>
        <TableBody>
          {#each tableData as row}
            <TableBodyRow>
              {#each headers as header}
                <TableBodyCell>{row[header]}</TableBodyCell>
              {/each}
            </TableBodyRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  {:else}
    <p class="text-gray-500">No data to display. Please upload an Excel or CSV file.</p>
  {/if}
</div> 