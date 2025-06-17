import { describe, test, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';

import App from '../App.svelte';

describe('App Component', () => {
  test('App renders the SpreadsheetViewer component', () => {
    render(App);
    expect(screen.getByText('Drop files here or click to upload')).toBeInTheDocument();
    expect(screen.getByText('Upload an Excel or CSV file to get started')).toBeInTheDocument();
  });
});
