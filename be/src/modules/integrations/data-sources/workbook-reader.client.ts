import { Injectable } from "@nestjs/common"
import readXlsxFile from "read-excel-file/universal"
import type { WorkbookReader, WorkbookSheet } from "./workbook-reader.contracts"

@Injectable()
/** Reads Excel workbook bytes with the universal XLSX reader. */
export class WorkbookReaderClient implements WorkbookReader {
    /** Passes the uploaded bytes to the library and returns its worksheets unchanged. */
    read(bytes: Uint8Array): Promise<ReadonlyArray<WorkbookSheet>> {
        return readXlsxFile(new Blob([new Uint8Array(bytes)]))
    }
}
