import { CooMatrix } from "./matrix_sparse_coo";

export interface CsrMatrix {
  nRows: number;
  nCols: number;
  rowPtr: Int32Array;   // length nRows + 1
  colIdx: Int32Array;   // length nnz
  val: Float64Array;    // length nnz
}

export function cooToCsr(coo: CooMatrix): CsrMatrix {
  const { nRows, nCols, entries } = coo;
  const nnz = entries.length;
  const rowPtr = new Int32Array(nRows + 1);
  const colIdx = new Int32Array(nnz);
  const val = new Float64Array(nnz);

  // Count entries per row
  for (const e of entries) {
    if (e.i < 0 || e.i >= nRows) {
      throw new Error(`COO row index out of range: ${e.i}`);
    }

    if (e.j < 0 || e.j >= nCols) {
      throw new Error(`COO col index out of range: ${e.j}`);
    }

    rowPtr[e.i + 1]++;
  }

  // Prefix sum
  for (let i = 0; i < nRows; i++) {
    rowPtr[i + 1] += rowPtr[i];
  }

  // Fill columns/values
  const next = rowPtr.slice(); // copy
  for (const e of entries) {
    const pos = next[e.i]++;
    colIdx[pos] = e.j;
    val[pos] = e.v;
  }

  return { nRows, nCols, rowPtr, colIdx, val };
}