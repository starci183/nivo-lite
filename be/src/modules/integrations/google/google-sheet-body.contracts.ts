/** The text format of a cell: the header rows are bold. */
export interface SheetTextFormat {
    /** True for a bold text. */
    readonly bold: boolean
}

/** The format a cell is entered with. */
export interface SheetCellFormat {
    /** The text format. */
    readonly textFormat: SheetTextFormat
}

/** The value of a text cell. */
export interface SheetStringValue {
    /** The text. */
    readonly stringValue: string
}

/** The value of a number cell. */
export interface SheetNumberValue {
    /** The number. */
    readonly numberValue: number
}

/** A cell that holds a text, bold when it is a header. */
export interface SheetTextCell {
    /** The text. */
    readonly userEnteredValue: SheetStringValue
    /** The format, when the cell is not plain. */
    readonly userEnteredFormat?: SheetCellFormat
}

/** A cell that holds a number. */
export interface SheetNumberCell {
    /** The number. */
    readonly userEnteredValue: SheetNumberValue
}

/** A cell of the create body. */
export type SheetBodyCell = SheetTextCell | SheetNumberCell

/** One row of the create body. */
export interface SheetBodyRow {
    /** The cells, left to right. */
    readonly values: ReadonlyArray<SheetBodyCell>
}

/** The width of one column in pixels. */
export interface SheetColumnSize {
    /** The width. */
    readonly pixelSize: number
}

/** The rows of a tab from its first cell. */
export interface SheetGridData {
    /** The first row. */
    readonly startRow: number
    /** The first column. */
    readonly startColumn: number
    /** The width of each column. */
    readonly columnMetadata: ReadonlyArray<SheetColumnSize>
    /** The rows. */
    readonly rowData: ReadonlyArray<SheetBodyRow>
}

/** The size of a tab and how much of it stays in view. */
export interface SheetGridProperties {
    /** The header rows that stay in view. */
    readonly frozenRowCount: number
    /** The rows. */
    readonly rowCount: number
    /** The columns. */
    readonly columnCount: number
}

/** The identity and size of a tab. */
export interface SheetTabProperties {
    /** The id of the tab. */
    readonly sheetId: number
    /** The title. */
    readonly title: string
    /** The place among the tabs. */
    readonly index: number
    /** The grid. */
    readonly gridProperties: SheetGridProperties
}

/** One tab of the create body. */
export interface SheetTab {
    /** The identity and size. */
    readonly properties: SheetTabProperties
    /** The rows. */
    readonly data: ReadonlyArray<SheetGridData>
}

/** The title, language and time zone of a spreadsheet. */
export interface SpreadsheetProperties {
    /** The title. */
    readonly title: string
    /** The locale. */
    readonly locale: string
    /** The time zone. */
    readonly timeZone: string
}

/** The body of spreadsheets.create. */
export interface SheetCreateBody {
    /** The spreadsheet. */
    readonly properties: SpreadsheetProperties
    /** The tabs. */
    readonly sheets: ReadonlyArray<SheetTab>
}

/** How a number is shown. */
export interface SheetNumberFormat {
    /** The kind of number. */
    readonly type: string
    /** The pattern. */
    readonly pattern: string
}

/** The format a repeated cell is entered with. */
export interface SheetRepeatedFormat {
    /** How the number is shown. */
    readonly numberFormat: SheetNumberFormat
    /** Left, right or centre. */
    readonly horizontalAlignment: string
}

/** The cell a request repeats down a range. */
export interface SheetRepeatedCell {
    /** The format. */
    readonly userEnteredFormat: SheetRepeatedFormat
}

/** The range a request covers. */
export interface SheetRange {
    /** The tab. */
    readonly sheetId: number
    /** The first row. */
    readonly startRowIndex: number
    /** The first column. */
    readonly startColumnIndex: number
    /** The column after the last. */
    readonly endColumnIndex: number
}

/** A request that repeats one cell over a range. */
export interface SheetRepeatCell {
    /** The range. */
    readonly range: SheetRange
    /** The cell. */
    readonly cell: SheetRepeatedCell
    /** The fields the request sets. */
    readonly fields: string
}

/** One request of the follow-up batchUpdate. */
export interface SheetFormatRequest {
    /** The repeated cell. */
    readonly repeatCell: SheetRepeatCell
}

/** The body of the follow-up batchUpdate. */
export interface SheetFormatBody {
    /** The requests. */
    readonly requests: ReadonlyArray<SheetFormatRequest>
}
