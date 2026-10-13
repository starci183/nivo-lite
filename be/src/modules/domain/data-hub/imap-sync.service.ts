import { Injectable } from "@nestjs/common"
import type { DataConnector, DataSyncResult } from "./data-hub.contracts"

@Injectable()
/** Pulls the owner mailboxes into the hub. */
export class ImapSyncService implements DataConnector {
    readonly provider = "imap" as const

    /** Not built yet. */
    sync(): Promise<DataSyncResult> {
        return Promise.resolve({ rows: 0 })
    }
}
