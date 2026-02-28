import ExcelJS from "exceljs";

// Validation result types
interface ValidationError {
  type: string;
  message: string;
  severity: "error" | "warning";
  details?: string;
}

interface ParsedRow {
  date: Date;
  variables: Record<string, number>;
}

interface ParseResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  data: ParsedRow[];
  columns: string[];
  rowCount: number;
}

// IQR-based outlier detection threshold
const IQR_MULTIPLIER = 3.0;

// Maximum allowed missing rate per column
const MAX_MISSING_RATE = 0.3; // 30%

/**
 * Parse and validate an uploaded Excel file.
 * 7-stage validation pipeline:
 * 1. File format check
 * 2. Header validation
 * 3. Date validation
 * 4. Numeric type check
 * 5. Missing rate check
 * 6. Outlier detection (IQR)
 * 7. Period consistency check
 */
export async function parseExcelUpload(
  fileBuffer: Buffer,
  expectedDateRange?: { start: Date; end: Date }
): Promise<ParseResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const data: ParsedRow[] = [];

  // Stage 1: File format
  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
  } catch {
    errors.push({
      type: "FORMAT",
      message: "ファイル形式が不正です",
      severity: "error",
      details: ".xlsx形式のExcelファイルをアップロードしてください",
    });
    return { success: false, errors, warnings, data: [], columns: [], rowCount: 0 };
  }

  const sheet = workbook.getWorksheet("メディアデータ") || workbook.worksheets[0];
  if (!sheet) {
    errors.push({
      type: "FORMAT",
      message: "ワークシートが見つかりません",
      severity: "error",
    });
    return { success: false, errors, warnings, data: [], columns: [], rowCount: 0 };
  }

  // Stage 2: Header validation
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  if (headers.length === 0 || headers[0] !== "date") {
    errors.push({
      type: "HEADER",
      message: "ヘッダーが不正です",
      severity: "error",
      details: "1列目は「date」である必要があります",
    });
    return { success: false, errors, warnings, data: [], columns: headers, rowCount: 0 };
  }

  const dataColumns = headers.slice(1);

  // Stage 3-6: Row-by-row validation
  const columnValues: Record<string, number[]> = {};
  for (const col of dataColumns) {
    columnValues[col] = [];
  }

  // Skip header row (row 1) and sub-header row (row 2 if exists)
  const startRow = sheet.getRow(2).getCell(1).value &&
    typeof sheet.getRow(2).getCell(1).value === "string" &&
    isNaN(Date.parse(String(sheet.getRow(2).getCell(1).value)))
    ? 3
    : 2;

  const dates: Date[] = [];
  const columnMissing: Record<string, number> = {};
  for (const col of dataColumns) {
    columnMissing[col] = 0;
  }

  let totalRows = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;

    const dateCell = row.getCell(1);
    let date: Date | null = null;

    // Stage 3: Date validation
    if (dateCell.value instanceof Date) {
      date = dateCell.value;
    } else if (typeof dateCell.value === "string" || typeof dateCell.value === "number") {
      date = new Date(dateCell.value);
    }

    if (!date || isNaN(date.getTime())) {
      errors.push({
        type: "DATE",
        message: `行${rowNumber}: 日付が不正です`,
        severity: "error",
        details: `値: ${dateCell.value}`,
      });
      return;
    }

    dates.push(date);
    totalRows++;

    const rowData: Record<string, number> = {};

    for (let i = 0; i < dataColumns.length; i++) {
      const col = dataColumns[i];
      const cell = row.getCell(i + 2);
      const rawValue = cell.value;

      // Stage 4: Numeric type check
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        columnMissing[col]++;
        rowData[col] = 0; // Default missing to 0
        continue;
      }

      const numValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));

      if (isNaN(numValue)) {
        errors.push({
          type: "TYPE",
          message: `行${rowNumber}, 列${col}: 数値ではありません`,
          severity: "error",
          details: `値: ${rawValue}`,
        });
        rowData[col] = 0;
        continue;
      }

      rowData[col] = numValue;
      columnValues[col].push(numValue);
    }

    data.push({ date, variables: rowData });
  });

  // Stage 5: Missing rate check
  for (const col of dataColumns) {
    if (totalRows === 0) continue;
    const missingRate = columnMissing[col] / totalRows;
    if (missingRate > MAX_MISSING_RATE) {
      warnings.push({
        type: "MISSING",
        message: `列「${col}」の欠損率が${(missingRate * 100).toFixed(0)}%です`,
        severity: "warning",
        details: `許容値: ${(MAX_MISSING_RATE * 100).toFixed(0)}%以下`,
      });
    }
  }

  // Stage 6: Outlier detection (IQR method)
  for (const col of dataColumns) {
    const values = columnValues[col];
    if (values.length < 10) continue; // Need enough data for IQR

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    if (iqr === 0) continue;

    const lowerBound = q1 - IQR_MULTIPLIER * iqr;
    const upperBound = q3 + IQR_MULTIPLIER * iqr;

    const outliers = values.filter((v) => v < lowerBound || v > upperBound);
    if (outliers.length > 0) {
      warnings.push({
        type: "OUTLIER",
        message: `列「${col}」に${outliers.length}件の異常値があります`,
        severity: "warning",
        details: `範囲: ${lowerBound.toFixed(0)} 〜 ${upperBound.toFixed(0)}`,
      });
    }
  }

  // Stage 7: Period consistency check
  if (expectedDateRange && dates.length > 0) {
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const dataStart = sortedDates[0];
    const dataEnd = sortedDates[sortedDates.length - 1];

    const startDiff = Math.abs(dataStart.getTime() - expectedDateRange.start.getTime());
    const endDiff = Math.abs(dataEnd.getTime() - expectedDateRange.end.getTime());
    const dayMs = 24 * 60 * 60 * 1000;

    if (startDiff > 7 * dayMs || endDiff > 7 * dayMs) {
      warnings.push({
        type: "PERIOD",
        message: "Excelの期間がShopifyデータと一致しません",
        severity: "warning",
        details:
          `Excel: ${dataStart.toISOString().slice(0, 10)} 〜 ${dataEnd.toISOString().slice(0, 10)}, ` +
          `Shopify: ${expectedDateRange.start.toISOString().slice(0, 10)} 〜 ${expectedDateRange.end.toISOString().slice(0, 10)}`,
      });
    }

    // Check for gaps (missing dates)
    const dateSet = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
    let gapCount = 0;
    for (
      let d = new Date(dataStart);
      d <= dataEnd;
      d = new Date(d.getTime() + dayMs)
    ) {
      if (!dateSet.has(d.toISOString().slice(0, 10))) {
        gapCount++;
      }
    }

    if (gapCount > 0) {
      warnings.push({
        type: "GAP",
        message: `${gapCount}日分のデータが欠損しています`,
        severity: "warning",
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === "error");

  return {
    success: !hasErrors,
    errors,
    warnings,
    data,
    columns: headers,
    rowCount: totalRows,
  };
}
