declare module 'canvas-datagrid' {
  interface CanvasDataGridOptions {
    parentNode: HTMLElement;
    data: any[];
    [key: string]: any;
  }

  interface CanvasDataGridStyle {
    height: string;
    width: string;
    [key: string]: any;
  }

  interface CanvasDataGrid {
    style: CanvasDataGridStyle;
  }

  function canvasDatagrid(options: CanvasDataGridOptions): CanvasDataGrid;
  export default canvasDatagrid;
}
