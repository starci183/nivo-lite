/** One worksheet returned by a workbook reader. */
export interface WorkbookSheet {
    /** The worksheet's name. */
    readonly sheet: string
    /** The worksheet's rows and cell values. */
    readonly data: ReadonlyArray<ReadonlyArray<unknown>>
}

/** The port that reads worksheets from uploaded workbook bytes. */
export interface WorkbookReader {
    /** Reads all worksheets in their workbook order. */
    read(bytes: Uint8Array): Promise<ReadonlyArray<WorkbookSheet>>
}
