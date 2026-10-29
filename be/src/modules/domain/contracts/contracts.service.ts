import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { LeadReadService } from "@modules/domain/leads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, InjectRequestLocale } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { NOTE_MAX, checkContract } from "./contract.policy"
import { ContractLinkService } from "./contract-link.service"
import { appendNoteLine, displayDayOf, nextTermOf } from "./contract-term.policy"
import type { ContractResult, LinkedCustomers, PaidRenewal, SaveContractParams } from "./contracts.contracts"
import { ContractsError, ContractsErrorCode } from "./errors/contracts.error"
import { ContractEntity } from "./persistence/entities"

type SavedContract = Pick<
    ContractEntity,
    "id" | "leadId" | "customerName" | "plan" | "startsOn" | "endsOn" | "amountVnd" | "status" | "note"
>

/** The columns a write answers, named as the entity properties, days as YYYY-MM-DD text and the amount as a number. */
const RETURNED = [
    "id",
    'lead_id AS "leadId"',
    'customer_name AS "customerName"',
    "plan",
    "to_char(starts_on, 'YYYY-MM-DD') AS \"startsOn\"",
    "to_char(ends_on, 'YYYY-MM-DD') AS \"endsOn\"",
    'amount_vnd::float8 AS "amountVnd"',
    "status",
    "note",
].join(", ")

/** True when a RETURNING row carries a stored contract, the shape the returned columns give it. */
const isSavedContract = (value: unknown): value is SavedContract =>
    typeof value === "object" &&
    value !== null &&
    ["id", "customerName", "plan", "startsOn", "endsOn", "status", "note"].every(
        (field) => typeof Reflect.get(value, field) === "string",
    )

/** The first contract a write answered. */
const firstSaved = (raw: unknown): SavedContract | undefined =>
    Array.isArray(raw) ? raw.find(isSavedContract) : undefined

/** The locale of the lines a renewal writes on its own: the workspace owners read them in Vietnamese. */
/** The fields a contract write carries. */
type ContractFields = Pick<
    ContractEntity,
    "leadId" | "customerName" | "plan" | "startsOn" | "endsOn" | "amountVnd" | "status" | "note"
>

const RECORD_LOCALE = "vi"
/** The actor of the lines the system writes on its own. */
const SYSTEM_ACTOR = "NIVO"

const resultOf = (row: SavedContract): ContractResult => ({
    id: row.id,
    leadId: row.leadId,
    customerName: row.customerName,
    plan: row.plan,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    amountVnd: row.amountVnd,
    status: row.status,
    note: row.note,
})

@Injectable()
/** The recurring sales contracts reached only through the shared primary EntityManager. */
export class ContractsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly links: ContractLinkService,
        private readonly leads: LeadReadService,
    ) {}

    /** Lists recurring contracts after proving the caller belongs to their workspace. */
    async list(workspaceId: string, userId: string): Promise<Array<ContractResult>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.entityManager.find(ContractEntity, {
            where: { workspaceId },
            order: { endsOn: "ASC", id: "ASC" },
            take: 300,
        })
        return rows.map(resultOf)
    }

    /** Links a customer to a contract that was typed in by name only, on the system's behalf; a contract that has a lead keeps it. */
    async attachLead(workspaceId: string, contractId: string, leadId: string): Promise<void> {
        if (!(await this.leads.isOwn(workspaceId, leadId))) return
        await this.entityManager
            .createQueryBuilder(ContractEntity, "c")
            .update()
            .set({ leadId, updatedAt: () => "now()" })
            .where("workspace_id = :workspaceId AND id = :contractId AND lead_id IS NULL", {
                workspaceId,
                contractId,
            })
            .execute()
    }

    /**
     * Links every contract of the workspace to a lead the renewal can reach, on the system's behalf (after an import, or asked
     * for); ContractLinkService owns the matching.
     */
    linkCustomers(workspaceId: string): Promise<LinkedCustomers> {
        return this.links.linkCustomers(workspaceId)
    }

    /** Links the contracts of the workspace to their customers after proving the caller belongs to it. */
    async linkCustomersFor(userId: string, workspaceId: string): Promise<LinkedCustomers> {
        await this.members.require(userId, workspaceId)
        return this.links.linkCustomers(workspaceId)
    }

    /**
     * Adds or edits a recurring contract (the renewal automation reads these). The contract is judged first; a linked lead
     * must belong to the workspace (a lead of another workspace answers no row); an edit changes only the workspace own row. The write and its evidence line share one transaction.
     */
    async saveContract(params: SaveContractParams): Promise<ContractResult> {
        const member = await this.members.require(params.userId, params.workspaceId)
        return this.entityManager.transaction(async (tx) => {
            const verdict = checkContract(params)
            if (verdict.kind === "refused") throw new ContractsError({ code: verdict.code, params: verdict.params })
            const contract = verdict.value
            const fields = {
                leadId: params.leadId,
                customerName: contract.customerName,
                plan: contract.plan,
                startsOn: contract.startsOn,
                endsOn: contract.endsOn,
                amountVnd: contract.amountVnd,
                status: contract.status,
                note: contract.note,
            }
            const row =
                params.contractId === null
                    ? await this.insertContract(tx, params.workspaceId, fields)
                    : await this.updateContract(tx, params.workspaceId, params.contractId, fields)
            if (row === undefined) {
                throw new ContractsError(
                    params.contractId === null
                        ? { code: ContractsErrorCode.LeadNotFound, params: { id: String(params.leadId) } }
                        : { code: ContractsErrorCode.NotFound, params: { id: params.contractId } },
                )
            }
            const created = params.contractId === null
            await this.events.record(
                {
                    workspaceId: params.workspaceId,
                    leadId: params.leadId,
                    kind: created ? "contract.created" : "contract.updated",
                    actor: member.displayName,
                    summary: this.messages.get(
                        created ? "contracts.created" : "contracts.updated",
                        { who: member.displayName, customer: contract.customerName },
                        this.requestLocale.of(params.acceptLanguage),
                    ),
                    evidence: `${contract.startsOn} → ${contract.endsOn}`,
                },
                tx,
            )
            return resultOf(row)
        })
    }

    /**
     * Moves a contract to its next term once the renewal invoice of its current term is paid, on the system's behalf: the next term
     * is as long as the current one (one year when it has none), the contract is active again, its note says which invoice paid
     * for it, and the change is logged as `contract.updated` in the same transaction. It applies only while the contract still ends
     * on `periodEndsOn`, so a repeat or a stale invoice changes nothing (`extended` false); a cancelled contract is never renewed.
     */
    extendForPaidRenewal(
        workspaceId: string,
        contractId: string,
        periodEndsOn: string,
        invoiceNo: string,
        manager?: EntityManager,
    ): Promise<PaidRenewal> {
        const extend = async (tx: EntityManager): Promise<PaidRenewal> => {
            const current = await tx
                .createQueryBuilder(ContractEntity, "c")
                .where("c.workspaceId = :workspaceId AND c.id = :contractId", { workspaceId, contractId })
                .limit(1)
                .setLock("pessimistic_write")
                .getOne()
            if (current === null) {
                throw new ContractsError({ code: ContractsErrorCode.NotFound, params: { id: contractId } })
            }
            const unchanged = { extended: false, contract: resultOf(current), previousEndsOn: current.endsOn }
            if (current.endsOn !== periodEndsOn || current.status === "cancelled") return unchanged
            const term = nextTermOf(current.startsOn, current.endsOn)
            const line = this.messages.get(
                "contracts.renewalNote",
                { until: displayDayOf(term.endsOn), no: invoiceNo },
                RECORD_LOCALE,
            )
            const extended = await tx
                .createQueryBuilder(ContractEntity, "c")
                .update()
                .set({
                    startsOn: term.startsOn,
                    endsOn: term.endsOn,
                    status: "active",
                    note: appendNoteLine(current.note, line, NOTE_MAX),
                    updatedAt: () => "now()",
                })
                .where(
                    "workspace_id = :workspaceId AND id = :contractId AND ends_on = :periodEndsOn::date AND status <> 'cancelled'",
                    {
                        workspaceId,
                        contractId,
                        periodEndsOn,
                    },
                )
                .returning(RETURNED)
                .execute()
            const row = firstSaved(extended.raw)
            if (row === undefined) return unchanged
            await this.events.record(
                {
                    workspaceId,
                    leadId: row.leadId,
                    kind: "contract.updated",
                    actor: SYSTEM_ACTOR,
                    summary: this.messages.get(
                        "contracts.renewed",
                        { customer: row.customerName, until: displayDayOf(row.endsOn), no: invoiceNo },
                        RECORD_LOCALE,
                    ),
                    evidence: `${row.startsOn} → ${row.endsOn}`,
                },
                tx,
            )
            return { extended: true, contract: resultOf(row), previousEndsOn: current.endsOn }
        }
        return manager === undefined ? this.entityManager.transaction(extend) : extend(manager)
    }

    /** Writes a new contract and answers it; answers nothing when the lead it names is not the workspace own (the lead row is held while the contract is written). */
    private async insertContract(
        tx: EntityManager,
        workspaceId: string,
        fields: ContractFields,
    ): Promise<SavedContract | undefined> {
        if (fields.leadId !== null && !(await this.leads.isOwn(workspaceId, fields.leadId, tx))) return undefined
        const inserted = await tx
            .createQueryBuilder(ContractEntity, "c")
            .insert()
            .values({ workspaceId, ...fields })
            .returning(RETURNED)
            .execute()
        return firstSaved(inserted.raw)
    }

    /** Changes one contract of the workspace and answers it; answers nothing when it is missing or the lead it names is not the workspace own. */
    private async updateContract(
        tx: EntityManager,
        workspaceId: string,
        contractId: string,
        fields: ContractFields,
    ): Promise<SavedContract | undefined> {
        if (fields.leadId !== null && !(await this.leads.isOwn(workspaceId, fields.leadId, tx))) return undefined
        const changed = await tx
            .createQueryBuilder(ContractEntity, "c")
            .update()
            .set({ ...fields, updatedAt: () => "now()" })
            .where("workspace_id = :workspaceId AND id = :contractId", { workspaceId, contractId })
            .returning(RETURNED)
            .execute()
        return firstSaved(changed.raw)
    }
}
