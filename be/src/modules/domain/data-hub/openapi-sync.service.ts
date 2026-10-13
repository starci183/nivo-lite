import { Injectable } from "@nestjs/common"
import type { DataConnector, DataSyncResult } from "./data-hub.contracts"

@Injectable()
/** Pulls the owner APIs into the hub. */
export class OpenApiSyncService implements DataConnector {
    readonly provider = "openapi" as const

    /** Not built yet. */
    sync(): Promise<DataSyncResult> {
        return Promise.resolve({ rows: 0 })
    }
}
