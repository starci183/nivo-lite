import { Injectable } from "@nestjs/common"
import type { DataConnector, DataSyncResult } from "./data-hub.contracts"

@Injectable()
/** Pulls the Excel, CSV and document imports into the hub. */
export class CsvImportSyncService implements DataConnector {
    readonly provider = "csv_import" as const

    /** Not built yet. */
    sync(): Promise<DataSyncResult> {
        return Promise.resolve({ rows: 0 })
    }
}
