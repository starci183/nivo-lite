import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InvoicesService } from "@modules/domain/invoices"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { normalizeAdjustment } from "./adjustment.policy"
import type { AccountingAdjustmentRow, NewAccountingAdjustment } from "./accounting-adjustments.contracts"
import { AccountingAdjustmentsError, AccountingAdjustmentsErrorCode } from "./errors/accounting-adjustments.error"
import { AccountingAdjustmentEntity } from "./persistence/entities"

/** The correction history and whether its optional migration is present. */
export interface AccountingAdjustmentHistory {
    /** The recorded corrections. */
    readonly items: ReadonlyArray<AccountingAdjustmentRow>
    /** False only when PostgreSQL reports the correction table is absent. */
    readonly ready: boolean
}

const missingTable = (error: unknown): boolean => {
    if (typeof error !== "object" || error === null) return false
    if ("code" in error && error.code === "42P01") return true
    return "driverError" in error && missingTable(error.driverError)
}

const toRow = (entity: AccountingAdjustmentEntity): AccountingAdjustmentRow => ({
    id: entity.id,
    target_type: entity.targetType,
    target_id: entity.targetId,
    note: entity.note,
    corrected_amount_vnd: entity.correctedAmountVnd === null ? null : Number(entity.correctedAmountVnd),
    created_by: entity.createdBy,
    created_at: entity.createdAt.toISOString(),
})

/** The columns the appending statement hands back. */
const RETURNED_COLUMNS = "id, target_type, target_id, note, corrected_amount_vnd, created_by, created_at"

/** The correction the appending statement hands back: the driver delivers bigint as text and timestamptz as a Date. */
interface CreatedRow {
    readonly id: string
    readonly target_type: "invoice" | "transaction"
    readonly target_id: string
    readonly note: string
    readonly corrected_amount_vnd: string | null
    readonly created_by: string
    readonly created_at: Date
}

@Injectable()
/** The only owner of public.accounting_adjustments; every correction and its evidence line commit together. */
export class AccountingAdjustmentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly invoices: InvoicesService,
        private readonly transactions: TransactionsService,
        private readonly events: EventsService,
    ) {}
    /** Lists the latest append-only corrections; the caller proves membership before reading. */
    async list(workspaceId: string): Promise<Array<AccountingAdjustmentRow>> {
        const entities = await this.entityManager.find(AccountingAdjustmentEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC", id: "DESC" },
            take: 500,
        })
        return entities.map(toRow)
    }

    /** Distinguishes an unapplied optional migration from other database failures. */
    async history(workspaceId: string): Promise<AccountingAdjustmentHistory> {
        try {
            return { items: await this.list(workspaceId), ready: true }
        } catch (error) {
            if (missingTable(error)) return { items: [], ready: false }
            throw error
        }
    }
    /** Owner or manager appends a correction to a target in the same workspace and logs the verified member name. */
    async create(
        principalId: string,
        workspaceId: string,
        request: NewAccountingAdjustment,
    ): Promise<AccountingAdjustmentRow> {
        const member = await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const input = normalizeAdjustment(request)
        const target =
            input.targetType === "invoice"
                ? await this.invoices.find(workspaceId, input.targetId)
                : await this.transactions.find(workspaceId, input.targetId)
        if (target === null) throw new AccountingAdjustmentsError({ code: AccountingAdjustmentsErrorCode.NotFound })
        const leadId = "lead_id" in target ? target.lead_id : null
        return this.entityManager.transaction(async (manager) => {
            const inserted = await manager
                .createQueryBuilder(AccountingAdjustmentEntity, "aa")
                .insert()
                .values({
                    workspaceId,
                    targetType: input.targetType,
                    targetId: input.targetId,
                    note: input.note,
                    correctedAmountVnd: input.correctedAmount === null ? null : String(input.correctedAmount),
                    createdBy: member.displayName,
                })
                .returning(RETURNED_COLUMNS)
                .execute()
            const [created] = Array.isArray(inserted.raw) ? (inserted.raw as Array<CreatedRow>) : []
            if (created === undefined)
                throw new AccountingAdjustmentsError({ code: AccountingAdjustmentsErrorCode.NotCreated })
            await this.events.record(
                {
                    workspaceId,
                    leadId,
                    kind: "accounting.adjustment",
                    actor: member.displayName,
                    summary:
                        input.correctedAmount === null ? input.note : `${input.note} (${input.correctedAmount} VND)`,
                    evidence: input.note,
                },
                manager,
            )
            return {
                id: created.id,
                target_type: created.target_type,
                target_id: created.target_id,
                note: created.note,
                corrected_amount_vnd:
                    created.corrected_amount_vnd === null ? null : Number(created.corrected_amount_vnd),
                created_by: created.created_by,
                created_at: created.created_at.toISOString(),
            }
        })
    }
}
