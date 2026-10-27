import { Injectable } from "@nestjs/common"
import { ContractsService } from "@modules/domain/contracts"
import { InjectTable } from "@modules/integrations/data-sources"
import type { Table, TableClient } from "@modules/integrations/data-sources"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { isDomainError } from "@modules/platform/errors"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    ContractImportPreview,
    ContractImportPreviewRequest,
    ContractImportRequest,
    ContractImportResult,
    ContractImportSkip,
    ContractImportSource,
} from "./contract-import.contracts"
import { contractKey, mappingOf, readContractRows, skipReason, suggestContractMapping } from "./contract-import.policy"
import { invalid } from "./csv-import-config.policy"
import { decodeUpload, pastedText } from "./csv-import-source.policy"
import { CONTRACT_IMPORT_COPY } from "./messages/contract-import.messages"

/** How many judged rows a preview shows. */
const PREVIEW_ROWS = 20
/** The most rows one import saves, each through its own transaction. */
export const CONTRACT_IMPORT_MAX_ROWS = 2_000
/** Vietnam is seven hours ahead of UTC; the calendar day of the workspace is the Vietnamese one. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

@Injectable()
/** The bulk import of recurring sales contracts from an uploaded .csv/.xlsx or pasted text, saved one by one through the contracts capability. */
export class ContractImportService {
    constructor(
        private readonly contracts: ContractsService,
        @InjectTable() private readonly table: TableClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Reads the source and answers its headers, the mapping (suggested unless one is given), the first rows judged and the counts. */
    async preview(request: ContractImportPreviewRequest): Promise<ContractImportPreview> {
        const existing = await this.existingKeys(request)
        const table = await this.readSource(request)
        const mapping =
            request.mapping === null || request.mapping === undefined
                ? suggestContractMapping(table.headers)
                : mappingOf(request.mapping, table.headers)
        const rows = readContractRows(table, mapping, this.today(), existing)
        return {
            headers: table.headers,
            sheets: table.sheets,
            sheet: table.sheet,
            mapping,
            rows: rows.slice(0, PREVIEW_ROWS),
            total: rows.length,
            ready: rows.filter((row) => skipReason(row) === null).length,
        }
    }

    /**
     * Saves every row the mapping reads as a valid contract through ContractsService.saveContract; a row with a problem, a
     * contract the workspace already has (same customer, plan and last day) or one the contracts capability refuses is
     * skipped with its reason. The contracts are then linked to their data-hub customers (ContractsService.linkCustomers), so the
     * renewal can reach them.
     */
    async importContracts(request: ContractImportRequest): Promise<ContractImportResult> {
        const existing = await this.existingKeys(request)
        const table = await this.readSource(request)
        if (table.rows.length > CONTRACT_IMPORT_MAX_ROWS) {
            throw invalid(CONTRACT_IMPORT_COPY.tooManyRows(CONTRACT_IMPORT_MAX_ROWS))
        }
        const mapping = mappingOf(request.mapping, table.headers)
        if (mapping.customerName === null || mapping.endsOn === null) throw invalid(CONTRACT_IMPORT_COPY.chooseColumns)
        const rows = readContractRows(table, mapping, this.today(), existing)
        const skipped: Array<ContractImportSkip> = []
        let created = 0
        await eachInOrder(rows, async (row) => {
            const reason = skipReason(row)
            if (reason !== null || row.startsOn === null || row.endsOn === null) {
                skipped.push({ row: row.row, reason: reason ?? "endsOnMissing" })
                return
            }
            try {
                await this.contracts.saveContract({
                    workspaceId: request.workspaceId,
                    userId: request.userId,
                    acceptLanguage: request.acceptLanguage,
                    contractId: null,
                    leadId: null,
                    customerName: row.customerName,
                    plan: row.plan,
                    startsOn: row.startsOn,
                    endsOn: row.endsOn,
                    amountVnd: row.amountVnd,
                    status: row.status,
                    note: row.note,
                })
                created += 1
            } catch (error) {
                if (!isDomainError(error)) throw error
                skipped.push({ row: row.row, reason: error.code })
            }
        })
        return { created, skipped, customers: await this.contracts.linkCustomers(request.workspaceId) }
    }

    /** The keys of the contracts the workspace holds; listing them also proves the caller belongs to the workspace. */
    private async existingKeys(source: ContractImportSource): Promise<ReadonlySet<string>> {
        const contracts = await this.contracts.list(source.workspaceId, source.userId)
        return new Set(contracts.map((contract) => contractKey(contract.customerName, contract.plan, contract.endsOn)))
    }

    /** The table of the uploaded file (it wins) or of the pasted text. */
    private readSource(source: ContractImportSource): Promise<Table> {
        const file = decodeUpload(source.file)
        if (file !== null) {
            const sheet = (source.sheet ?? "").slice(0, 200)
            return this.table.readFile(file.name, file.bytes, sheet === "" ? undefined : sheet)
        }
        if (source.text === null || source.text === undefined || source.text.trim() === "") {
            throw invalid(CONTRACT_IMPORT_COPY.chooseSource)
        }
        return Promise.resolve(this.table.readText(pastedText(source.text)))
    }

    /** Today in Vietnam, YYYY-MM-DD. */
    private today(): string {
        return new Date(this.clock.now().getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)
    }
}
