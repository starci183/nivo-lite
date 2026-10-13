import { Injectable } from "@nestjs/common"
import type { DataConnector, DataSyncResult } from "./data-hub.contracts"

@Injectable()
/** Pulls the personal Telegram accounts into the hub. */
export class TelegramUserSyncService implements DataConnector {
    readonly provider = "telegram_user" as const

    /** Not built yet. */
    sync(): Promise<DataSyncResult> {
        return Promise.resolve({ rows: 0 })
    }
}
