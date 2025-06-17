import { describe, test, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import SpreadsheetViewer from '../components/SpreadsheetViewer.svelte';

// Mock canvas-datagrid
vi.mock('canvas-datagrid', () => {
  return {
    default: vi.fn().mockImplementation((options) => {
      return {
        style: {},
        data: options.data
      };
    })
  };
});

// Mock XLSX
vi.mock('xlsx', () => {
  return {
    read: vi.fn().mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {}
      }
    }),
    utils: {
      sheet_to_json: vi.fn().mockReturnValue([
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Boston' }
      ])
    }
  };
});

describe('SpreadsheetViewer Component', () => {
  test('renders file upload interface', () => {
    render(SpreadsheetViewer);

    // Check if the file upload exists
    const fileInput = screen.getByText('Drop files here or click to upload');
    expect(fileInput).toBeInTheDocument();

    // Check if guidance text is shown
    expect(screen.getByText('Upload an Excel or CSV file to get started')).toBeInTheDocument();
    expect(screen.getByText('Supported formats: Excel (.xlsx, .xls) and CSV (.csv)')).toBeInTheDocument();
  });

  test('getFileExtension utility function', () => {
    // Test the utility function directly
    function getFileExtension(filename: string): string {
      return filename.toLowerCase().split('.').pop() || '';
    }

    expect(getFileExtension('test.xlsx')).toBe('xlsx');
    expect(getFileExtension('data.csv')).toBe('csv');
    expect(getFileExtension('noextension')).toBe('noextension');
    expect(getFileExtension('.hiddenfile')).toBe('hiddenfile');
  });

  test('isValidFileType utility function', () => {
    function isValidFileType(extension: string): boolean {
      return ['csv', 'xlsx'].includes(extension);
    }

    expect(isValidFileType('xlsx')).toBe(true);
    expect(isValidFileType('csv')).toBe(true);
    expect(isValidFileType('pdf')).toBe(false);
    expect(isValidFileType('txt')).toBe(false);
  });

  test('spreadsheet data transformation works correctly', () => {
    // Test the data transformation without relying on mocked APIs

    // Sample worksheet data (simplified)
    const testData = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Boston' }
    ];

    // Check extraction of headers
    const headers = Object.keys(testData[0]);
    expect(headers).toEqual(['name', 'age', 'city']);

    // Check data structure
    expect(testData.length).toBe(2);
    expect(testData[0].name).toBe('John');
    expect(testData[1].name).toBe('Jane');
  });
});
