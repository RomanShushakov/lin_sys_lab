export interface CooEntry {
  i: number; // row index, 0-based
  j: number; // col index, 0-based
  v: number;
}

export interface CooMatrix {
  nRows: number;
  nCols: number;
  entries: CooEntry[];
}
