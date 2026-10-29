import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { automationRunsEntities } from "@modules/domain/automation-runs"
import { bankFeedInboxEntities } from "@modules/domain/bank-feed-inbox"
import { contractsEntities } from "@modules/domain/contracts"
import { eventsEntities } from "@modules/domain/events"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { invoicesEntities } from "@modules/domain/invoices"
import { transactionsEntities } from "@modules/domain/transactions"
import { workItemsEntities } from "@modules/domain/work-items"
import { sql } from "@modules/platform/database"
import { inboxEntities } from "@modules/platform/inbox"
import { jobsEntities } from "@modules/platform/jobs"

const [BankFeedInboxEntity] = bankFeedInboxEntities

const [AutomationRunEntity] = automationRunsEntities

const [WorkItemEntity] = workItemsEntities

const [InboxEntity] = inboxEntities
const [JobEntity] = jobsEntities
const [TransactionEntity] = transactionsEntities

const [ContractEntity] = contractsEntities
const [EventEntity] = eventsEntities
const [InboundEventEntity] = inboundEventsEntities
const [InvoiceEntity] = invoicesEntities

/** The most rows one proof read takes; the proofs seed far fewer. */
const PROOF_ROWS_MAX = 1000

/** The queued bank-feed receipts of one connection, oldest first ($1 connection id). */
const FEED_DELIVERIES = sql`
    SELECT id::text AS id, queue, name, payload FROM public.job_outbox
    WHERE queue = 'bank-feed-delivery' AND starts_with(payload->>'deliveryId', $1)
    ORDER BY created_at, id`

/** Removes the queue rows of the bank-feed receipts of one connection ($1 connection id). */
const CLEAN_FEED_OUTBOX = sql`
    DELETE FROM public.job_outbox
    WHERE queue = 'bank-feed-delivery' AND starts_with(payload->>'deliveryId', $1)`

/** One invoice as the database holds it. */
export interface InvoiceState {
    readonly id: string
    readonly invoice_no: string
    readonly amount_vnd: number
    readonly status: string
    readonly lead_id: string | null
    readonly contract_id: string | null
    readonly period_ends_on: string | null
    readonly paid_at: string | null
}

/** One invoice a proposal offers. */
export interface ProposalCandidateState {
    readonly id: string
}

/** The part of a work item's proposal the proof reads. */
export interface ProposalState {
    readonly draft?: string
    readonly candidates?: ReadonlyArray<ProposalCandidateState>
}

/** One work item as the database holds it. */
export interface WorkItemState {
    readonly id: string
    readonly status: string
    readonly decided_path: string | null
    readonly reason: string | null
    readonly inbound_event_id: string | null
    readonly lead_id: string | null
    readonly proposal: ProposalState
}

/** One bank credit as an inbound event. */
export interface BankEventState {
    readonly id: string
    readonly status: string
    readonly amount_vnd: number
    readonly external_ref: string | null
    readonly event_id: string | null
}

/** One bank transaction. */
export interface TransactionState {
    readonly id: string
    readonly status: string
    readonly invoice_id: string | null
    readonly amount_vnd: number
}

/** One contract as it stands. */
export interface ContractState {
    readonly starts_on: string
    readonly ends_on: string
    readonly note: string
    readonly status: string
}

/** One step of an automation run. */
export interface RunStepState {
    readonly label: string
}

/** One automation run. */
export interface RunState {
    readonly status: string
    readonly steps: ReadonlyArray<RunStepState>
}

/** One evidence line. */
export interface EvidenceState {
    readonly summary: string
    readonly evidence: string | null
}

/** One queued job as the outbox holds it. */
export interface OutboxJob {
    readonly id: string
    readonly queue: string
    readonly name: string
    readonly payload: object
}

/** One claim a reactor made in the inbox for a delivery key. */
export interface EventClaim {
    readonly queue: string
    readonly id: string
}

/** The renewal invoices of one contract period, oldest first. */
export const renewalInvoices = (
    manager: EntityManager,
    workspaceId: string,
    contractId: string,
): Promise<Array<InvoiceState>> =>
    manager
        .createQueryBuilder(InvoiceEntity, "i")
        .select("i.id", "id")
        .addSelect("i.invoice_no", "invoice_no")
        .addSelect("i.amount_vnd::float8", "amount_vnd")
        .addSelect("i.status", "status")
        .addSelect("i.lead_id", "lead_id")
        .addSelect("i.contract_id", "contract_id")
        .addSelect("i.period_ends_on::text", "period_ends_on")
        .addSelect("i.paid_at", "paid_at")
        .where("i.workspace_id = :workspaceId AND i.contract_id = :contractId", { workspaceId, contractId })
        .orderBy("i.created_at")
        .getRawMany<InvoiceState>()

/** The work items of one action in a workspace, oldest first. */
export const workItemsOfAction = (
    manager: EntityManager,
    workspaceId: string,
    action: string,
): Promise<Array<WorkItemState>> =>
    manager
        .createQueryBuilder(WorkItemEntity, "w")
        .select("w.id", "id")
        .addSelect("w.status", "status")
        .addSelect("w.decided_path", "decided_path")
        .addSelect("w.reason", "reason")
        .addSelect("w.inbound_event_id", "inbound_event_id")
        .addSelect("w.lead_id", "lead_id")
        .addSelect("w.proposal", "proposal")
        .where("w.workspace_id = :workspaceId AND w.action = :action", { workspaceId, action })
        .orderBy("w.created_at")
        .addOrderBy("w.id")
        .getRawMany<WorkItemState>()

/** The runs of one pipeline, oldest first. */
export const pipelineRuns = (manager: EntityManager, pipelineId: string): Promise<Array<RunState>> =>
    manager
        .createQueryBuilder(AutomationRunEntity, "r")
        .select("r.status", "status")
        .addSelect("r.steps", "steps")
        .where("r.pipeline_id = :pipelineId", { pipelineId })
        .orderBy("r.created_at")
        .addOrderBy("r.id")
        .getRawMany<RunState>()

/** The contract as it stands. */
export const contractState = (
    manager: EntityManager,
    workspaceId: string,
    contractId: string,
): Promise<Array<ContractState>> =>
    manager
        .createQueryBuilder(ContractEntity, "c")
        .select("c.starts_on::text", "starts_on")
        .addSelect("c.ends_on::text", "ends_on")
        .addSelect("c.note", "note")
        .addSelect("c.status", "status")
        .where("c.workspace_id = :workspaceId AND c.id = :contractId", { workspaceId, contractId })
        .getRawMany<ContractState>()

/** The bank credits of a workspace as inbound events, oldest first. */
export const bankEvents = (manager: EntityManager, workspaceId: string): Promise<Array<BankEventState>> =>
    manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.id", "id")
        .addSelect("e.status", "status")
        .addSelect("e.amount_vnd::float8", "amount_vnd")
        .addSelect("e.external_ref", "external_ref")
        .addSelect("e.event_id", "event_id")
        .addSelect("e.lead_id", "lead_id")
        .addSelect("e.duplicate_count", "duplicate_count")
        .where("e.workspace_id = :workspaceId AND e.channel = 'bank'", { workspaceId })
        .orderBy("e.created_at")
        .addOrderBy("e.id")
        .getRawMany<BankEventState>()

/** The bank transactions of a workspace, oldest first. */
export const bankTransactions = (manager: EntityManager, workspaceId: string): Promise<Array<TransactionState>> =>
    manager
        .createQueryBuilder(TransactionEntity, "t")
        .select("t.id", "id")
        .addSelect("t.status", "status")
        .addSelect("t.invoice_id", "invoice_id")
        .addSelect("t.amount_vnd::float8", "amount_vnd")
        .where("t.workspace_id = :workspaceId", { workspaceId })
        .orderBy("t.created_at")
        .addOrderBy("t.id")
        .getRawMany<TransactionState>()

/** The evidence lines of a workspace of one kind. */
export const evidenceOfKind = async (
    manager: EntityManager,
    workspaceId: string,
    kind: string,
): Promise<Array<EvidenceState>> => {
    const rows = await manager.find(EventEntity, { where: { workspaceId, kind }, take: PROOF_ROWS_MAX })
    return rows.map((row) => ({ summary: row.summary, evidence: row.evidence }))
}

/** The queued bank-feed receipts of one connection, oldest first. */
export const feedDeliveries = (manager: EntityManager, connectionId: string): Promise<Array<OutboxJob>> =>
    manager.query<Array<OutboxJob>>(FEED_DELIVERIES, [connectionId])

/** The inbox claims of the accounting reactor of `bank_credit_booked` for the credits of a workspace. */
export const bankCreditClaims = (manager: EntityManager, workspaceId: string): Promise<Array<EventClaim>> => {
    const credits = manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.id::text")
        .where("e.workspace_id = :workspaceId")
        .getQuery()
    return manager
        .createQueryBuilder(InboxEntity, "i")
        .select("i.source", "queue")
        .addSelect("i.delivery_id", "id")
        .where(`i.source = 'bank_credit_booked__accounting' AND i.delivery_id IN (${credits})`, { workspaceId })
        .orderBy("i.delivery_id")
        .getRawMany<EventClaim>()
}

/** Removes the claims the money reactors made for the facts of a workspace, before the workspace goes. */
export const cleanEventClaims = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    const credits = manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.id::text")
        .where("e.workspace_id = :workspaceId")
        .getQuery()
    const invoices = manager
        .createQueryBuilder(InvoiceEntity, "v")
        .select("v.id::text")
        .where("v.workspace_id = :workspaceId")
        .getQuery()
    await manager
        .createQueryBuilder(InboxEntity, "t")
        .delete()
        .where(
            `(source = 'bank_credit_booked__accounting' AND delivery_id IN (${credits}))
             OR (source = 'payment_reconciled__contracts' AND delivery_id IN (${invoices}))`,
            { workspaceId },
        )
        .execute()
}

/** Removes the bank-feed receipts of one connection and their queue rows, which no workspace owns. */
export const cleanFeedReceipts = async (manager: EntityManager, connectionId: string): Promise<void> => {
    await manager.query(CLEAN_FEED_OUTBOX, [connectionId])
    await manager
        .createQueryBuilder(BankFeedInboxEntity, "t")
        .delete()
        .where("starts_with(delivery_id, :connectionId)", { connectionId })
        .execute()
}

/** Removes the claims the scenario's queue deliveries left, keyed by their outbox row ids. */
export const cleanJobKeys = async (manager: EntityManager, jobKeys: ReadonlyArray<string>): Promise<void> => {
    await manager.delete(JobEntity, { jobKey: In([...jobKeys]) })
}
