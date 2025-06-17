<script lang="ts">
  import { Dropzone, Fileupload, Button, Label, Input } from 'flowbite-svelte';
  import * as XLSX from 'xlsx';
  import canvasDatagrid from 'canvas-datagrid';
  import { onMount } from 'svelte';

  let files = $state<FileList | undefined>(undefined);
  let tableData = $state<Record<string, any>[]>([]);
  let headers = $state<string[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let gridContainer = $state<HTMLDivElement | null>(null);
  let grid: any = null; // Not reactive, managed manually
  let currentFileName = $state<string>('');
  let exportFormat = $state<'xlsx' | 'csv'>('xlsx');

  // New spreadsheet creation states
  let showNewSpreadsheetDialog = $state(false);
  let newSpreadsheetName = $state('New Spreadsheet');
  let newSpreadsheetRows = $state(10);
  let newSpreadsheetColumns = $state(5);

  // Use $derived instead of $state + $effect
  let columnNames = $derived(
    Array(newSpreadsheetColumns)
      .fill('')
      .map((_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''))
  );

  function resetData() {
    tableData = [];
    headers = [];
    error = null;
  }

  function cleanupGrid() {
    if (grid && typeof grid.dispose === 'function') {
      grid.dispose();
      grid = null;
    }
  }

  $effect(() => {
    if (!files?.[0]) {
      return;
    }
    currentFileName = files[0].name.split('.')[0]; // Store the file name for export
    processFile(files[0]);
  });

  $effect(() => {
    // Only run this when tableData changes
    if (tableData.length > 0 && gridContainer) {
      // Clean up previous grid before creating a new one
      cleanupGrid();

      // Create new grid with latest data
      grid = canvasDatagrid({
        parentNode: gridContainer,
        data: tableData,
        editable: true
      });

      grid.style.height = '400px';
      grid.style.width = '100%';
    }
  });

  onMount(() => {
    return () => {
      cleanupGrid();
    };
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

  function exportData() {
    if (!grid) return;

    try {
      // Get the current data from the grid (including any edits)
      const currentData = grid.data;

      // Create a new worksheet from the data
      const worksheet = XLSX.utils.json_to_sheet(currentData);

      // Create a workbook with the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      // Generate appropriate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `${currentFileName}_export_${timestamp}`;

      // Export based on selected format
      if (exportFormat === 'xlsx') {
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else {
        XLSX.writeFile(workbook, `${filename}.csv`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      error = err instanceof Error ? err.message : 'An error occurred during export.';
    }
  }

  function getFileExtension(filename: string): string {
    return filename.toLowerCase().split('.').pop() || '';
  }

  function isValidFileType(extension: string): boolean {
    return ['csv', 'xlsx'].includes(extension);
  }

  function createNewSpreadsheet() {
    try {
      // Generate column headers (A, B, C, ... Z, AA, AB, etc.)
      const headers = columnNames.slice();

      // Create empty rows with the given column headers
      const data = Array(newSpreadsheetRows)
        .fill(0)
        .map(() => {
          const row: Record<string, any> = {};
          headers.forEach((header) => {
            row[header] = '';
          });
          return row;
        });

      // Set the data
      tableData = data;
      currentFileName = newSpreadsheetName;

      // Close the dialog
      showNewSpreadsheetDialog = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while creating the spreadsheet.';
    }
  }
</script>

<div class="p-4">
  <div class="mb-4 flex justify-between">
    <div>
      <Fileupload bind:files accept=".xlsx,.csv" size="md" clearable={true} disabled={isLoading} />
      <p class="mt-1 text-sm text-gray-500">Supported formats: Excel (.xlsx, .xls) and CSV (.csv)</p>
    </div>
    <div>
      <Button size="md" color="green" onclick={() => (showNewSpreadsheetDialog = true)}>
        <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        New Spreadsheet
      </Button>
    </div>
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
    <div class="mb-2 flex items-center justify-between">
      <div class="text-sm text-gray-600">
        <span class="font-medium">{currentFileName}</span>: {tableData.length} row{tableData.length !== 1 ? 's' : ''} with {headers.length} column{headers.length !== 1 ? 's' : ''}
      </div>
      <div class="flex items-center gap-2">
        <select bind:value={exportFormat} class="rounded-md border border-gray-300 text-sm">
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
        </select>
        <Button size="sm" onclick={exportData}>
          <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export
        </Button>
      </div>
    </div>
    <div class="rounded-lg border">
      <div bind:this={gridContainer} class="w-full"></div>
    </div>
  {:else}
    <div class="py-8 text-center text-gray-500">
      <Dropzone bind:files>
        <svg class="mx-auto mb-4 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p class="text-lg font-medium">Drop files here or click to upload</p>
        <p class="mt-2 text-sm">Upload an Excel or CSV file to get started</p>
      </Dropzone>
    </div>
  {/if}
</div>

<!-- Custom dialog for new spreadsheet creation -->
{#if showNewSpreadsheetDialog}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-gray-600">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-xl font-medium text-gray-900">Create New Spreadsheet</h3>
        <button type="button" class="rounded-lg bg-transparent p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-900" onclick={() => (showNewSpreadsheetDialog = false)} aria-label="Close dialog">
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <Label for="spreadsheet-name">Spreadsheet Name</Label>
          <Input id="spreadsheet-name" placeholder="Enter name..." bind:value={newSpreadsheetName} />
        </div>
        <div>
          <Label for="rows-count">Number of Rows</Label>
          <Input id="rows-count" type="number" min="1" max="1000" bind:value={newSpreadsheetRows} />
        </div>
        <div>
          <Label for="columns-count">Number of Columns</Label>
          <Input id="columns-count" type="number" min="1" max="50" bind:value={newSpreadsheetColumns} />
        </div>
        <div class="text-sm text-gray-500">Column names will be automatically generated (A, B, C, ...)</div>
      </div>

      <div class="mt-6 flex gap-2">
        <Button color="green" onclick={createNewSpreadsheet}>Create Spreadsheet</Button>
        <Button color="gray" onclick={() => (showNewSpreadsheetDialog = false)}>Cancel</Button>
      </div>
    </div>
  </div>
{/if}
