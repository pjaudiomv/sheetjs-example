<script lang="ts">
  import { Dropzone, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Fileupload } from 'flowbite-svelte';
  import * as XLSX from 'xlsx';

  let files = $state<FileList | undefined>(undefined);
  let tableData = $state<Record<string, any>[]>([]);
  let headers = $state<string[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let sortColumn = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  function resetData() {
    tableData = [];
    headers = [];
    error = null;
    sortColumn = null;
    sortDirection = 'asc';
  }

  $effect(() => {
    if (!files?.[0]) {
      resetData();
      return;
    }
    processFile(files[0]);
  });

  async function processFile(file: File) {
    isLoading = true;
    error = null;

    try {
      const extension = getFileExtension(file.name);

      if (!isValidFileType(extension)) {
        throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: 'array',
        raw: extension === 'csv'
      });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      if (jsonData.length === 0) {
        throw new Error('The file appears to be empty or has no readable data.');
      }

      headers = Object.keys(jsonData[0]);
      tableData = jsonData;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while processing the file.';
      resetData();
    } finally {
      isLoading = false;
    }
  }

  function getFileExtension(filename: string): string {
    return filename.toLowerCase().split('.').pop() || '';
  }

  function isValidFileType(extension: string): boolean {
    return ['csv', 'xlsx'].includes(extension);
  }

  // Format cell values for display
  function formatCellValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && !isFinite(value)) return '';
    return String(value);
  }

  function handleSort(column: string) {
    if (sortColumn === column) {
      // If clicking the same column, toggle direction
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, set as ascending
      sortColumn = column;
      sortDirection = 'asc';
    }

    tableData = [...tableData].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];

      // Handle null/undefined values
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1;
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1;

      // Compare based on type
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Default string comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }
</script>

<div class="p-4">
  <div class="mb-4">
    <Fileupload bind:files accept=".xlsx,.csv" size="md" clearable={true} disabled={isLoading} />
    <p class="mt-1 text-sm text-gray-500">Supported formats: Excel (.xlsx, .xls) and CSV (.csv)</p>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg border border-red-200 bg-red-100 p-3 text-sm text-red-700">
      {error}
    </div>
  {/if}

  {#if isLoading}
    <div class="flex items-center justify-center p-8">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Processing file...</span>
    </div>
  {:else if tableData.length > 0}
    <div class="mb-2 text-sm text-gray-600">
      Showing {tableData.length} row{tableData.length !== 1 ? 's' : ''} with {headers.length} column{headers.length !== 1 ? 's' : ''}
    </div>
    <div class="max-h-96 overflow-y-auto rounded-lg border">
      <Table striped={true} divClass="overflow-visible">
        <TableHead class="sticky top-0 z-10">
          {#each headers as header (header)}
            <TableHeadCell class="bg-gray-50 p-0 whitespace-nowrap before:absolute before:inset-0 before:z-[-1] before:bg-gray-50">
              <button class="flex h-full w-full cursor-pointer items-center gap-1 px-6 py-3 text-left select-none hover:bg-gray-100" onclick={() => handleSort(header)}>
                {header}
                {#if sortColumn === header}
                  <span class="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                {/if}
              </button>
            </TableHeadCell>
          {/each}
        </TableHead>
        <TableBody>
          {#each tableData as row, _ (_)}
            <TableBodyRow>
              {#each headers as header (header)}
                <TableBodyCell class="whitespace-nowrap">
                  {formatCellValue(row[header])}
                </TableBodyCell>
              {/each}
            </TableBodyRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  {/if}
</div>
<div class="py-8 text-center text-gray-500">
  <Dropzone bind:files>
    <svg class="mx-auto mb-4 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <p class="text-lg font-medium">Drop files here or click to upload</p>
    <p class="mt-2 text-sm">Upload an Excel or CSV file to get started</p>
  </Dropzone>
</div>
