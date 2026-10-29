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
            const created = await manager.save(
                AccountingAdjustmentEntity,
                manager.create(AccountingAdjustmentEntity, {
                    workspaceId,
                    targetType: input.targetType,
                    targetId: input.targetId,
                    note: input.note,
                    correctedAmountVnd: input.correctedAmount === null ? null : String(input.correctedAmount),
                    createdBy: member.displayName,
                }),
            )
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
            return toRow(created)
        })
    }
}
