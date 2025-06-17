<script lang="ts">
  import { Dropzone, Fileupload, Button, Label, Input } from 'flowbite-svelte';
  import * as XLSX from 'xlsx';
  import canvasDatagrid from 'canvas-datagrid';
  import { onMount } from 'svelte';

  let files = $state<FileList | undefined>(undefined);
  let sheets = $state<{ name: string; data: Record<string, any>[]; headers: string[] }[]>([]);
  let activeSheetIndex = $state<number>(0);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let gridContainer = $state<HTMLDivElement | null>(null);
  let grid: any = null; // Not reactive, managed manually
  let currentFileName = $state<string>('');
  let exportFormat = $state<'xlsx' | 'csv' | 'json'>('xlsx');

  // Remote source states
  let remoteUrl = $state<string>('');
  let remoteFormat = $state<'csv' | 'xlsx' | 'json'>('csv');
  let showRemoteSourceDialog = $state(false);

  // New spreadsheet creation states
  let showNewSpreadsheetDialog = $state(false);
  let newSpreadsheetName = $state('New Spreadsheet');
  let newSpreadsheetRows = $state(10);
  let newSpreadsheetColumns = $state(5);
  let newSpreadsheetSheets = $state([{ name: 'Sheet1', rows: 10, columns: 5 }]);

  // Get active sheet for easy access
  let activeSheet = $derived(sheets[activeSheetIndex] || { name: '', data: [], headers: [] });

  function resetData() {
    sheets = [];
    activeSheetIndex = 0;
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
    // Only run this when active sheet data changes
    if (activeSheet && activeSheet.data.length > 0 && gridContainer) {
      // Clean up previous grid before creating a new one
      cleanupGrid();

      // Create new grid with latest data
      grid = canvasDatagrid({
        parentNode: gridContainer,
        data: activeSheet.data,
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
        throw new Error('Unsupported file type. Please upload a CSV, Excel, or JSON file.');
      }

      if (extension === 'json') {
        // Process JSON file
        const text = await file.text();
        const jsonData = JSON.parse(text);

        // Handle JSON array format
        if (Array.isArray(jsonData)) {
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
          sheets = [
            {
              name: 'Sheet1',
              data: jsonData,
              headers
            }
          ];
        }
        // Handle JSON object with multiple sheets
        else if (typeof jsonData === 'object' && jsonData !== null) {
          const sheetNames = Object.keys(jsonData);
          if (sheetNames.length === 0) {
            throw new Error('The JSON data appears to be empty or invalid.');
          }

          sheets = sheetNames
            .map((sheetName) => {
              const sheetData = jsonData[sheetName];
              if (!Array.isArray(sheetData) || sheetData.length === 0) {
                return {
                  name: sheetName,
                  data: [],
                  headers: []
                };
              }

              const headers = Object.keys(sheetData[0]);
              return {
                name: sheetName,
                data: sheetData,
                headers
              };
            })
            .filter((sheet) => sheet.data.length > 0);
        } else {
          throw new Error('Invalid JSON format. Expected an array or object.');
        }
      } else {
        // Process CSV or Excel file
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, {
          type: 'array',
          raw: extension === 'csv'
        });

        // Process all sheets
        const processedSheets = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

          return {
            name: sheetName,
            data: jsonData,
            headers
          };
        }).filter((sheet) => sheet.data.length > 0); // Filter out empty sheets

        if (processedSheets.length === 0) {
          throw new Error('The file appears to be empty or has no readable data.');
        }

        sheets = processedSheets;
      }

      activeSheetIndex = 0;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while processing the file.';
      resetData();
    } finally {
      isLoading = false;
    }
  }

  async function fetchRemoteData() {
    if (!remoteUrl.trim()) {
      error = 'Please enter a valid URL';
      return;
    }

    isLoading = true;
    error = null;

    try {
      const response = await fetch(remoteUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      // Handle different format types
      switch (remoteFormat) {
        case 'json': {
          const jsonData = await response.json();

          // Handle JSON array format
          if (Array.isArray(jsonData)) {
            const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
            sheets = [
              {
                name: 'Sheet1',
                data: jsonData,
                headers
              }
            ];
          }
          // Handle JSON object with multiple sheets
          else if (typeof jsonData === 'object' && jsonData !== null) {
            const sheetNames = Object.keys(jsonData);
            if (sheetNames.length === 0) {
              throw new Error('The JSON data appears to be empty or invalid.');
            }

            sheets = sheetNames
              .map((sheetName) => {
                const sheetData = jsonData[sheetName];
                if (!Array.isArray(sheetData) || sheetData.length === 0) {
                  return {
                    name: sheetName,
                    data: [],
                    headers: []
                  };
                }

                const headers = Object.keys(sheetData[0]);
                return {
                  name: sheetName,
                  data: sheetData,
                  headers
                };
              })
              .filter((sheet) => sheet.data.length > 0);
          } else {
            throw new Error('Invalid JSON format. Expected an array or object.');
          }

          break;
        }
        case 'csv':
        case 'xlsx': {
          const buffer = await response.arrayBuffer();
          const workbook = XLSX.read(buffer, {
            type: 'array',
            raw: remoteFormat === 'csv'
          });

          // Process all sheets
          const processedSheets = workbook.SheetNames.map((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
            const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

            return {
              name: sheetName,
              data: jsonData,
              headers
            };
          }).filter((sheet) => sheet.data.length > 0); // Filter out empty sheets

          if (processedSheets.length === 0) {
            throw new Error('The file appears to be empty or has no readable data.');
          }

          sheets = processedSheets;
          break;
        }
        default:
          throw new Error('Unsupported format selected.');
      }

      activeSheetIndex = 0;
      currentFileName = new URL(remoteUrl).pathname.split('/').pop()?.split('.')[0] || 'remote-data';
      showRemoteSourceDialog = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while processing the remote data.';
      resetData();
    } finally {
      isLoading = false;
    }
  }

  function exportData() {
    if (sheets.length === 0) return;

    try {
      // Generate appropriate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `${currentFileName}_export_${timestamp}`;

      // For JSON export
      if (exportFormat === 'json') {
        // Collect all sheet data, including any edits in the active sheet
        const exportData: Record<string, any[]> = {};

        sheets.forEach((sheet, index) => {
          // Use grid data for active sheet (to include edits), otherwise use the stored data
          const sheetData = index === activeSheetIndex && grid ? grid.data : sheet.data;
          exportData[sheet.name] = sheetData;
        });

        // If there's only one sheet, export just the array
        const jsonData = sheets.length === 1 ? exportData[sheets[0].name] : exportData;
        const jsonString = JSON.stringify(jsonData, null, 2);

        // Create a blob and download it
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For CSV and XLSX formats
        const workbook = XLSX.utils.book_new();

        // Add each sheet to the workbook
        sheets.forEach((sheet, index) => {
          // Use grid data for active sheet (to include edits), otherwise use the stored data
          const sheetData = index === activeSheetIndex && grid ? grid.data : sheet.data;
          const worksheet = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
        });

        // Export based on selected format
        if (exportFormat === 'xlsx') {
          XLSX.writeFile(workbook, `${filename}.xlsx`);
        } else {
          XLSX.writeFile(workbook, `${filename}.csv`);
        }
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
    return ['csv', 'xlsx', 'json'].includes(extension);
  }

  function createNewSpreadsheet() {
    try {
      // Check for duplicate sheet names
      const sheetNames = newSpreadsheetSheets.map((sheet) => sheet.name);
      const uniqueNames = new Set(sheetNames);

      if (uniqueNames.size !== sheetNames.length) {
        // If there are duplicates, make them unique by appending numbers
        const usedNames = new Set<string>();

        newSpreadsheetSheets = newSpreadsheetSheets.map((sheet) => {
          let name = sheet.name;
          let counter = 1;

          // If name already exists, make it unique
          while (usedNames.has(name)) {
            name = `${sheet.name} (${counter})`;
            counter++;
          }

          usedNames.add(name);
          return { ...sheet, name };
        });

        // Notify the user but continue with creation
        error = 'Duplicate sheet names were found and have been made unique.';
        setTimeout(() => (error = null), 3000);
      }

      const newSheets = newSpreadsheetSheets.map((sheetConfig) => {
        // Generate column headers for this sheet
        const headers = Array(sheetConfig.columns)
          .fill('')
          .map((_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''));

        // Create empty rows with the given column headers
        const data = Array(sheetConfig.rows)
          .fill(0)
          .map(() => {
            const row: Record<string, any> = {};
            headers.forEach((header) => {
              row[header] = '';
            });
            return row;
          });

        return {
          name: sheetConfig.name,
          data,
          headers
        };
      });

      // Set the data
      sheets = newSheets;
      activeSheetIndex = 0;
      currentFileName = newSpreadsheetName;

      // Close the dialog
      showNewSpreadsheetDialog = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while creating the spreadsheet.';
    }
  }

  function addNewSheet() {
    // Base name for new sheet
    let baseName = 'Sheet';
    let counter = newSpreadsheetSheets.length + 1;
    let newSheetName = `${baseName}${counter}`;

    // Ensure the sheet name is unique
    while (newSpreadsheetSheets.some((s) => s.name === newSheetName)) {
      counter++;
      newSheetName = `${baseName}${counter}`;
    }

    newSpreadsheetSheets = [
      ...newSpreadsheetSheets,
      {
        name: newSheetName,
        rows: newSpreadsheetRows,
        columns: newSpreadsheetColumns
      }
    ];
  }

  function removeSheet(index: number) {
    if (newSpreadsheetSheets.length > 1) {
      newSpreadsheetSheets = newSpreadsheetSheets.filter((_, i) => i !== index);
    }
  }

  function addSheetToExisting() {
    // Get the current data to ensure it's saved
    if (grid && activeSheetIndex < sheets.length) {
      sheets[activeSheetIndex].data = grid.data;
    }

    // Generate column headers
    const headers = Array(5) // Default 5 columns for new sheet
      .fill('')
      .map((_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''));

    // Create empty rows
    const data = Array(10) // Default 10 rows for new sheet
      .fill(0)
      .map(() => {
        const row: Record<string, any> = {};
        headers.forEach((header) => {
          row[header] = '';
        });
        return row;
      });

    // Add new sheet with unique name
    let baseName = 'Sheet';
    let counter = sheets.length + 1;
    let newSheetName = `${baseName}${counter}`;

    // Ensure the sheet name is unique
    while (sheets.some((s) => s.name === newSheetName)) {
      counter++;
      newSheetName = `${baseName}${counter}`;
    }

    sheets = [...sheets, { name: newSheetName, data, headers }];
    activeSheetIndex = sheets.length - 1; // Switch to the new sheet
  }

  function renameActiveSheet(newName: string) {
    if (activeSheetIndex < sheets.length) {
      // Check if the name already exists in other sheets
      const nameExists = sheets.some((sheet, idx) => idx !== activeSheetIndex && sheet.name === newName);

      if (nameExists) {
        error = `A sheet named "${newName}" already exists. Please choose a different name.`;
        setTimeout(() => {
          error = null;
        }, 3000); // Clear error after 3 seconds
        return;
      }

      sheets[activeSheetIndex].name = newName;
      sheets = [...sheets]; // Trigger reactivity
    }
  }

  function deleteActiveSheet() {
    if (sheets.length > 1) {
      // Save current grid data if needed
      if (grid && activeSheetIndex < sheets.length) {
        sheets.forEach((sheet, i) => {
          if (i === activeSheetIndex) {
            sheet.data = grid.data;
          }
        });
      }

      // Remove the active sheet
      sheets = sheets.filter((_, i) => i !== activeSheetIndex);

      // Adjust activeSheetIndex if necessary
      activeSheetIndex = Math.min(activeSheetIndex, sheets.length - 1);
    }
  }

  // Show confirm dialog before deleting
  let showDeleteConfirmDialog = $state(false);
</script>

<div class="p-4">
  <div class="mb-4 flex flex-wrap justify-between gap-2">
    <div>
      <Fileupload bind:files accept=".xlsx,.csv,.json" size="md" clearable={true} disabled={isLoading} />
      <p class="mt-1 text-sm text-gray-500">Supported formats: Excel (.xlsx), CSV (.csv), and JSON (.json)</p>
    </div>
    <div class="flex gap-2">
      <Button size="md" color="blue" onclick={() => (showRemoteSourceDialog = true)}>
        <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Load Remote
      </Button>
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
  {:else if sheets.length > 0}
    <div class="mb-2 flex items-center justify-between">
      <div class="text-sm text-gray-600">
        <span class="font-medium">{currentFileName}</span>: {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
      </div>
      <div class="flex items-center gap-2">
        <select bind:value={exportFormat} class="rounded-md border border-gray-300 text-sm">
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="json">JSON (.json)</option>
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

    <!-- Sheet tabs -->
    <div class="mb-2 flex border-b border-gray-200">
      <div class="flex flex-grow overflow-x-auto">
        {#each sheets as sheet, i (`${i}-${sheet.name}`)}
          <button
            class="min-w-[100px] px-3 py-2 text-sm font-medium {activeSheetIndex === i ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-blue-500'}"
            onclick={() => {
              if (grid && activeSheetIndex < sheets.length) {
                sheets[activeSheetIndex].data = grid.data;
              }
              activeSheetIndex = i;
            }}
          >
            {sheet.name}
          </button>
        {/each}
      </div>
      <div class="flex">
        <!-- Sheet management buttons -->
        <button class="p-2 text-gray-500 hover:text-blue-500" title="Add sheet" aria-label="Add sheet" onclick={addSheetToExisting}>
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          class="p-2 text-gray-500 hover:text-blue-500"
          title="Rename sheet"
          aria-label="Rename sheet"
          onclick={() => {
            const newName = prompt('Enter new sheet name', activeSheet.name);
            if (newName) renameActiveSheet(newName);
          }}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          class="p-2 text-gray-500 hover:text-red-500"
          title="Delete sheet"
          aria-label="Delete sheet"
          onclick={() => {
            showDeleteConfirmDialog = sheets.length > 1;
          }}
          disabled={sheets.length <= 1}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="mb-2">
      <div class="text-sm text-gray-600">
        Sheet: <span class="font-medium">{activeSheet.name}</span> -
        {activeSheet.data.length} row{activeSheet.data.length !== 1 ? 's' : ''} with
        {activeSheet.headers.length} column{activeSheet.headers.length !== 1 ? 's' : ''}
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
        <p class="mt-2 text-sm">Upload an Excel, CSV, or JSON file to get started</p>
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

        <div class="border-t border-gray-200 pt-4">
          <h4 class="mb-2 font-medium">Sheets</h4>

          {#each newSpreadsheetSheets as sheetConfig, index (index)}
            <div class="mb-3 rounded border border-gray-200 p-3">
              <div class="mb-2 flex items-center justify-between">
                <h5 class="font-medium">Sheet {index + 1}</h5>
                {#if newSpreadsheetSheets.length > 1}
                  <button class="text-red-500 hover:text-red-700" onclick={() => removeSheet(index)} aria-label="Remove sheet">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                {/if}
              </div>

              <div class="space-y-2">
                <div>
                  <Label for={`sheet-name-${index}`}>Sheet Name</Label>
                  <Input id={`sheet-name-${index}`} placeholder="Sheet name..." bind:value={sheetConfig.name} />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <Label for={`rows-count-${index}`}>Rows</Label>
                    <Input id={`rows-count-${index}`} type="number" min="1" max="1000" bind:value={sheetConfig.rows} />
                  </div>
                  <div>
                    <Label for={`columns-count-${index}`}>Columns</Label>
                    <Input id={`columns-count-${index}`} type="number" min="1" max="50" bind:value={sheetConfig.columns} />
                  </div>
                </div>
              </div>
            </div>
          {/each}

          <Button size="sm" color="blue" onclick={addNewSheet} class="mt-1 w-full">
            <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Sheet
          </Button>
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        <Button color="green" onclick={createNewSpreadsheet}>Create Spreadsheet</Button>
        <Button color="gray" onclick={() => (showNewSpreadsheetDialog = false)}>Cancel</Button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete sheet confirmation dialog -->
{#if showDeleteConfirmDialog}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-gray-600">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <div class="mb-4">
        <h3 class="text-xl font-medium text-gray-900">Delete Sheet</h3>
        <p class="mt-2 text-gray-600">Are you sure you want to delete the sheet "{activeSheet.name}"? This action cannot be undone.</p>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <Button
          color="gray"
          onclick={() => {
            showDeleteConfirmDialog = false;
          }}>Cancel</Button
        >
        <Button
          color="red"
          onclick={() => {
            deleteActiveSheet();
            showDeleteConfirmDialog = false;
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Remote Source Dialog -->
{#if showRemoteSourceDialog}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-gray-600">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-xl font-medium text-gray-900">Load Remote Data</h3>
        <button type="button" class="rounded-lg bg-transparent p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-900" onclick={() => (showRemoteSourceDialog = false)} aria-label="Close dialog">
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
          <Label for="remote-url">Remote URL</Label>
          <Input id="remote-url" placeholder="https://example.com/data.csv" bind:value={remoteUrl} />
          <p class="mt-1 text-xs text-gray-500">Enter the full URL to a CSV, Excel, or JSON file</p>
        </div>

        <div>
          <Label for="remote-format">File Format</Label>
          <div class="mt-1">
            <select id="remote-format" bind:value={remoteFormat} class="w-full rounded-md border border-gray-300 p-2 text-sm">
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <p class="mt-1 text-xs text-gray-500">JSON must be an array of objects or an object with sheet names as keys and arrays as values</p>
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        <Button color="blue" onclick={fetchRemoteData}>Load Data</Button>
        <Button color="gray" onclick={() => (showRemoteSourceDialog = false)}>Cancel</Button>
      </div>
    </div>
  </div>
{/if}
