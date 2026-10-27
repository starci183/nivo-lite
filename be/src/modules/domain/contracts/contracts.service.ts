import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, InjectRequestLocale } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { NOTE_MAX, checkContract } from "./contract.policy"
import { appendNoteLine, displayDayOf, nextTermOf } from "./contract-term.policy"
import type { ContractResult, PaidRenewal, SaveContractParams } from "./contracts.contracts"
import { ContractsError, ContractsErrorCode } from "./errors/contracts.error"
import type { ContractsRow } from "./persistence/contracts.rows"
import {
    ATTACH_CONTRACT_LEAD,
    EXTEND_CONTRACT_TERM,
    INSERT_CONTRACT,
    LIST_CONTRACTS,
    LOCK_CONTRACT,
    UPDATE_CONTRACT,
} from "./persistence/contracts.sql"

type SavedContract = Pick<
    ContractsRow,
    "id" | "lead_id" | "customer_name" | "plan" | "starts_on" | "ends_on" | "amount_vnd" | "status" | "note"
>

/** The locale of the lines a renewal writes on its own: the workspace owners read them in Vietnamese. */
const RECORD_LOCALE = "vi"
/** The actor of the lines the system writes on its own. */
const SYSTEM_ACTOR = "NIVO"

const resultOf = (row: SavedContract): ContractResult => ({
    id: row.id,
    leadId: row.lead_id,
    customerName: row.customer_name,
    plan: row.plan,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    amountVnd: row.amount_vnd,
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
    ) {}

    /** Lists recurring contracts after proving the caller belongs to their workspace. */
    async list(workspaceId: string, userId: string): Promise<Array<ContractResult>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.entityManager.query<Array<ContractsRow>>(LIST_CONTRACTS, [workspaceId])
        return rows.map(resultOf)
    }

    /** Links a customer to a contract that was typed in by name only, on the system's behalf; a contract that has a lead keeps it. */
    async attachLead(workspaceId: string, contractId: string, leadId: string): Promise<void> {
        await this.entityManager.query(ATTACH_CONTRACT_LEAD, [workspaceId, contractId, leadId])
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
            const fields = [
                params.leadId,
                contract.customerName,
                contract.plan,
                contract.startsOn,
                contract.endsOn,
                contract.amountVnd,
                contract.status,
                contract.note,
            ]
            const [row] = await (params.contractId === null
                ? tx.query<Array<SavedContract>>(INSERT_CONTRACT, [params.workspaceId, ...fields])
                : tx.query<Array<SavedContract>>(UPDATE_CONTRACT, [params.workspaceId, params.contractId, ...fields]))
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
    ): Promise<PaidRenewal> {
        return this.entityManager.transaction(async (tx) => {
            const [current] = await tx.query<Array<SavedContract>>(LOCK_CONTRACT, [workspaceId, contractId])
            if (current === undefined) {
                throw new ContractsError({ code: ContractsErrorCode.NotFound, params: { id: contractId } })
            }
            const unchanged = { extended: false, contract: resultOf(current), previousEndsOn: current.ends_on }
            if (current.ends_on !== periodEndsOn || current.status === "cancelled") return unchanged
            const term = nextTermOf(current.starts_on, current.ends_on)
            const line = this.messages.get(
                "contracts.renewalNote",
                { until: displayDayOf(term.endsOn), no: invoiceNo },
                RECORD_LOCALE,
            )
            const [row] = await tx.query<Array<SavedContract>>(EXTEND_CONTRACT_TERM, [
                workspaceId,
                contractId,
                periodEndsOn,
                term.startsOn,
                term.endsOn,
                appendNoteLine(current.note, line, NOTE_MAX),
            ])
            if (row === undefined) return unchanged
            await this.events.record(
                {
                    workspaceId,
                    leadId: row.lead_id,
                    kind: "contract.updated",
                    actor: SYSTEM_ACTOR,
                    summary: this.messages.get(
                        "contracts.renewed",
                        { customer: row.customer_name, until: displayDayOf(row.ends_on), no: invoiceNo },
                        RECORD_LOCALE,
                    ),
                    evidence: `${row.starts_on} → ${row.ends_on}`,
                },
                tx,
            )
            return { extended: true, contract: resultOf(row), previousEndsOn: current.ends_on }
        })
    }
}
