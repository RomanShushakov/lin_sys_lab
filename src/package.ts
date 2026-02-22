/* Do not change these import lines to match external modules in webpack configuration */
import * as grok from 'datagrok-api/grok';
import * as ui from 'datagrok-api/ui';
import * as DG from 'datagrok-api/dg';
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
    if (!Number.isFinite(i) || !Number.isFinite(j) || !Number.isFinite(v))
      continue;
    if (i >= 0 && i < nRows) rowNnz[i]++;
    if (i === j) diagCount++;
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
