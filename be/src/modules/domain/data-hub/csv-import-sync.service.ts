import { Injectable } from "@nestjs/common"
import { InjectTable } from "@modules/integrations/data-sources"
import type { TableClient } from "@modules/integrations/data-sources"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { DataRecordsService } from "./data-records.service"
import { CSV_COPY } from "./messages/csv-import.messages"
import { invalid, mappingOf, missingColumns, readConfig, summaryOf } from "./csv-import-config.policy"
import { buildRecords } from "./csv-import-records.policy"

@Injectable()
/** The scheduled re-read of a saved Google Sheets link into the hub (an uploaded file has nothing to re-read). */
export class CsvImportSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "csv_import" as const

    constructor(
        private readonly records: DataRecordsService,
        @InjectTable() private readonly table: TableClient,
    ) {}

    /** Re-reads the saved Google Sheets link with the saved mapping and upserts the rows. */
    async sync(context: DataSyncContext): Promise<DataSyncResult> {
        const config = readConfig(context.connection.meta)
        if (config === null || config.source !== "sheet" || config.link === undefined) {
            return { rows: 0, note: CSV_COPY.uploadAgain }
        }
        const table = await this.table.readSheetLink(config.link)
        const missing = missingColumns(config, table.headers)
        if (missing.length > 0) {
            throw invalid(CSV_COPY.sheetChanged(missing.join(", ")))
        }
        const { records } = buildRecords(table, mappingOf(config))
        const updated = await this.records.countExisting(
            context.connection.id,
            config.entity,
            records.map((record) => record.externalId),
        )
        const rows = await context.upsert(config.entity, records)
        const summary = summaryOf(config.entity, await this.records.count(context.connection.id))
        return { rows, note: CSV_COPY.syncNote(rows - updated, updated), meta: { summary } }
    }
}
