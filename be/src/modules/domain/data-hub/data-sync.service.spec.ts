import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import { DataRecordsService } from "@modules/domain/data-records"
import { DataSyncRunsService } from "@modules/domain/data-sync-runs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DataSyncQueue } from "@modules/queues/data-sync"
import { CsvImportSyncService } from "./csv-import-sync.service"
import { DatabaseSyncService } from "./database-sync.service"
import { DataHubService } from "./data-hub.service"
import { DataSyncService } from "./data-sync.service"
import { ImapSyncService } from "./imap-sync.service"
import { OpenApiSyncService } from "./openapi-sync.service"
import { TelegramUserSyncService } from "./telegram-user-sync.service"

describe("DataSyncService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                DataSyncService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
                { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
                { provide: LOGGER, useValue: mock<Logger>() },
                { provide: DataSyncQueue, useValue: mock<DataSyncQueue>() },
                { provide: ConnectionsService, useValue: mock<ConnectionsService>() },
                { provide: DataHubService, useValue: mock<DataHubService>() },
                { provide: DataRecordsService, useValue: mock<DataRecordsService>() },
                { provide: DataSyncRunsService, useValue: mock<DataSyncRunsService>() },
                { provide: CsvImportSyncService, useValue: mock<CsvImportSyncService>() },
                { provide: DatabaseSyncService, useValue: mock<DatabaseSyncService>() },
                { provide: ImapSyncService, useValue: mock<ImapSyncService>() },
                { provide: OpenApiSyncService, useValue: mock<OpenApiSyncService>() },
                { provide: TelegramUserSyncService, useValue: mock<TelegramUserSyncService>() },
            ],
        }).compile()
        return moduleRef.get(DataSyncService)
    }

    it("ignores a job payload that is neither a tick nor a sync", async () => {
        const service = await build()

        await expect(service.process({})).resolves.toBeUndefined()
    })

    it("ignores an abandoned job that is not a sync", async () => {
        const service = await build()

        await expect(service.abandonJob({ tick: false })).resolves.toBeUndefined()
    })
})
