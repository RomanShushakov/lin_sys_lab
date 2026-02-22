/* Do not change these import lines to match external modules in webpack configuration */
import * as grok from 'datagrok-api/grok';
import * as ui from 'datagrok-api/ui';
import * as DG from 'datagrok-api/dg';
import { CooEntry, CooMatrix } from './core/matrix_sparse_coo';
import { cooToCsr, csrMatVec } from './core/matrix_csr';
export * from './package.g';

export const _package = new DG.Package();

//name: info
export function info() {
  grok.shell.info(_package.webRoot);
}

//name: analyzeCOO
//description: Analyze a sparse matrix in COO triplet form
//input: dataframe Adf
//input: column Ai {dataframe: Adf}
//input: column Aj {dataframe: Adf}
//input: column Av {dataframe: Adf}
//output: dataframe summary
export function analyzeCOO(
  Adf: DG.DataFrame,
  Ai: DG.Column,
  Aj: DG.Column,
  Av: DG.Column,
): DG.DataFrame {

  const nRows = 1 + Math.max(...Array.from({ length: Ai.length }, (_, r) => Number(Ai.get(r))));
  const nCols = 1 + Math.max(...Array.from({ length: Aj.length }, (_, r) => Number(Aj.get(r))));
  const nnz = Adf.rowCount;

  const rowNnz = new Int32Array(nRows);
  let diagCount = 0;
  let sumAbs = 0;

  for (let r = 0; r < Adf.rowCount; r++) {
    const i = Number(Ai.get(r));
    const j = Number(Aj.get(r));
    const v = Number(Av.get(r));

    if (!Number.isFinite(i) || !Number.isFinite(j) || !Number.isFinite(v)) {
      continue;
    }

    if (i >= 0 && i < nRows) {
      rowNnz[i]++;
    }

    if (i === j) {
      diagCount++;
    }

    sumAbs += Math.abs(v);
  }

  const avgNnzPerRow = nnz > 0 ? nnz / nRows : 0;
  const diagCoverage = nRows > 0 ? diagCount / nRows : 0;

  const metrics = [
    ['nRows', nRows],
    ['nCols', nCols],
    ['nnz', nnz],
    ['avgNnzPerRow', avgNnzPerRow],
    ['diagCoverage', diagCoverage],
    ['sumAbs', sumAbs],
  ];

  return DG.DataFrame.fromColumns([
    DG.Column.fromStrings('metric', metrics.map(m => m[0] as string)),
    DG.Column.fromList(DG.COLUMN_TYPE.FLOAT, 'value', metrics.map(m => m[1] as number)),
  ]);
}

function maxIndex(col: DG.Column): number {
  let max = -1;
  for (let i = 0; i < col.length; i++) {
    const v = Number(col.get(i));

    if (Number.isFinite(v) && v > max) {
      max = v;
    }
  }
  return max;
}

//name: rowStatsCOO
//description: Per-row statistics for a sparse matrix in COO triplet form
//input: dataframe Adf
//input: column Ai {dataframe: Adf}
//input: column Aj {dataframe: Adf}
//input: column Av {dataframe: Adf}
//output: dataframe rowStats
export function rowStatsCOO(
  Adf: DG.DataFrame,
  Ai: DG.Column,
  Aj: DG.Column,
  Av: DG.Column,
): DG.DataFrame {

  const nRows = 1 + maxIndex(Ai);
  const nCols = 1 + maxIndex(Aj);
  const nnz = Adf.rowCount;

  if (nRows <= 0 || nCols <= 0 || nnz === 0) {
    return DG.DataFrame.fromColumns([
      DG.Column.fromStrings('row', []),
      DG.Column.fromList(DG.COLUMN_TYPE.INT, 'nnz', []),
      DG.Column.fromList(DG.COLUMN_TYPE.FLOAT, 'sumAbs', []),
      DG.Column.fromList(DG.COLUMN_TYPE.BOOL, 'hasDiag', []),
    ]);
  }

  const nnzRow = new Int32Array(nRows);
  const sumAbs = new Float64Array(nRows);
  const hasDiag = new Int8Array(nRows); // 0/1

  for (let r = 0; r < Adf.rowCount; r++) {
    const i = Number(Ai.get(r));
    const j = Number(Aj.get(r));
    const v = Number(Av.get(r));
    if (!Number.isFinite(i) || !Number.isFinite(j) || !Number.isFinite(v)) {
      continue;
    }

    if (i < 0 || i >= nRows) {
      continue;
    }

    nnzRow[i]++;
    sumAbs[i] += Math.abs(v);

    if (i === j) {
      hasDiag[i] = 1;
    }
  }

  const rows: number[] = [];
  const nnzArr: number[] = [];
  const sumArr: number[] = [];
  const diagArr: boolean[] = [];

  for (let i = 0; i < nRows; i++) {
    rows.push(i);
    nnzArr.push(nnzRow[i]);
    sumArr.push(sumAbs[i]);
    diagArr.push(hasDiag[i] === 1);
  }

  return DG.DataFrame.fromColumns([
    DG.Column.fromList(DG.COLUMN_TYPE.INT, 'row', rows),
    DG.Column.fromList(DG.COLUMN_TYPE.INT, 'nnz', nnzArr),
    DG.Column.fromList(DG.COLUMN_TYPE.FLOAT, 'sumAbs', sumArr),
    DG.Column.fromList(DG.COLUMN_TYPE.BOOL, 'hasDiag', diagArr),
  ]);
}

function cooFromDf(Adf: DG.DataFrame, Ai: DG.Column, Aj: DG.Column, Av: DG.Column): CooMatrix {
  const nRows = 1 + maxIndex(Ai);
  const nCols = 1 + maxIndex(Aj);

  const entries: CooEntry[] = [];
  for (let r = 0; r < Adf.rowCount; r++) {
    const i = Number(Ai.get(r));
    const j = Number(Aj.get(r));
    const v = Number(Av.get(r));

    if (!Number.isFinite(i) || !Number.isFinite(j) || !Number.isFinite(v)) {
      continue;
    }

    entries.push({ i, j, v });
  }

  return { nRows, nCols, entries };
}

//name: spmvCOO
//description: Compute y = A*x where A is in COO form
//input: dataframe Adf
//input: column Ai {dataframe: Adf}
//input: column Aj {dataframe: Adf}
//input: column Av {dataframe: Adf}
//input: dataframe xdf
//input: column x {dataframe: xdf}
//output: dataframe ydf
export function spmvCOO(
  Adf: DG.DataFrame,
  Ai: DG.Column,
  Aj: DG.Column,
  Av: DG.Column,
  xdf: DG.DataFrame,
  x: DG.Column,
): DG.DataFrame {
  const coo = cooFromDf(Adf, Ai, Aj, Av);
  const A = cooToCsr(coo);

  const n = A.nCols;
  if (x.length !== n) {
    throw new Error(`x length ${x.length} != nCols ${n}`);
  }

  const xv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = Number(x.get(i));

    if (!Number.isFinite(v)) {
      throw new Error(`x[${i}] is not finite: ${x.get(i)}`);
    }

    xv[i] = v;
  }

  const yv = csrMatVec(A, xv);

  return DG.DataFrame.fromColumns([
    DG.Column.fromList(DG.COLUMN_TYPE.INT, 'i', Array.from({ length: A.nRows }, (_, i) => i)),
    DG.Column.fromList(DG.COLUMN_TYPE.FLOAT, 'y', Array.from(yv)),
  ]);
}