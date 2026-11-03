import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { REASON, judgeAndEffect, openClaimsOf } from "@nivo-lite/agent-sdk/reconcile"
import type { Candidate, Outcome } from "@nivo-lite/agent-sdk/reconcile"
import { DecisionsError, DecisionsErrorCode, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { Performed, PerformedBy, Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { InboundEventDetail } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrderPaymentClaimsService, OrdersService } from "@modules/domain/orders"
import type { PaymentClaimRow } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { AMOUNT_EVIDENCE } from "@modules/domain/work-items"
import type { ProposalCandidate } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { OrderPaymentJudgeService } from "./order-payment-judge.service"
import { ORDER_TARGET, arrivalOf, candidatesOf, claimOf } from "./order-payment.policy"
import { leadHref, textOf } from "./performer.policy"
import { PerformerKitService } from "./performer-kit.service"
import { InjectWorkPerformersOptions } from "./work-performers.decorators"
import type { WorkPerformersOptions } from "./work-performers.options"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

/** The action that checks a payment against the bank before it is booked. */
const RECONCILE = "reconcile_payment"

/** How many of the newest orders are looked at, and how many overdue claims one tick raises. */
const ORDERS_WINDOW = 200
const OVERDUE_BATCH = 50

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/** The reconciliation's own settings when the app root names none: orders of the last three days, a claim waits half an hour. */
const DEFAULT_WINDOW_HOURS = 72
const DEFAULT_CLAIM_TIMEOUT_MINUTES = 30

/** The reason codes the rules give; any other reason is the judge's own sentence. */
const REASON_CODES: ReadonlySet<string> = new Set(Object.values(REASON))

@Injectable()
/**
 * Accounting's side of the reconcile run of a bank credit (the run that the `bank_credit_booked` tag starts): the facts it registers
 * with the generic evidence, judge and claim machinery of `@nivo-lite/agent-sdk/reconcile`, and the effects it registers for the three
 * ends. `plan` gathers the open orders and the customers' claims and decides; `open` writes the work item of a match (the gate performs it)
 * or of an ambiguity (the owner decides); `settle` is the effect of a match, approved by the gate or by the owner; `raiseOverdue` is the
 * end of a claim whose money never came.
 */
export class OrderPaymentReconcileService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkPerformersOptions() private readonly options: WorkPerformersOptions,
        private readonly kit: PerformerKitService,
        private readonly orders: OrdersService,
        private readonly claims: OrderPaymentClaimsService,
        private readonly judge: OrderPaymentJudgeService,
        private readonly transactions: TransactionsService,
        private readonly inbound: InboundEventsService,
        private readonly engine: WorkEngineService,
        private readonly evidence: EvidenceService,
        private readonly leads: LeadRecordsService,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /**
     * The decision on a recorded credit, or null when there is no open order to match it to. The code and amount rule goes first, then the
     * evidence; only a credit with some evidence reaches the model.
     */
    async plan(ctx: WorkContext, event: InboundEventDetail): Promise<Outcome | null> {
        if (event.amount_vnd === null) return null
        const now = this.clock.now().getTime()
        const windowMs = (this.options.orderWindowHours ?? DEFAULT_WINDOW_HOURS) * HOUR_MS
        const candidates = await this.candidates(ctx, now - windowMs)
        if (candidates.length === 0) return null
        const claims = (await this.claims.openOf(ctx.workspaceId)).map(claimOf)
        return judgeAndEffect(
            arrivalOf(event, event.amount_vnd, now),
            candidates,
            claims,
            (brief) => this.judge.judge(ctx.workspaceId, brief),
            { windowMs },
        )
    }

    /**
     * Writes the work item the outcome calls for: a match is preset clear (the gate performs it under the owner's authority), an ambiguity
     * or an amount mismatch is preset unclear and always asks the owner. The reasons ride on the item and in the evidence log; nothing is
     * marked paid here.
     */
    async open(ctx: WorkContext, event: InboundEventDetail, outcome: Outcome): Promise<WorkItem | null> {
        const { effect } = outcome
        if (effect.kind === "leave" || event.amount_vnd === null) return null
        const ids = effect.kind === "apply" ? [effect.candidateId] : effect.candidateIds
        const offered = outcome.candidates.filter((one) => ids.includes(one.candidate.id))
        const transaction = await this.transactionOf(ctx, event, event.amount_vnd)
        const amount = event.amount_vnd
        const reasons = outcome.reasons.map((reason) => this.reasonText(ctx, reason)).join(" · ")
        const [first] = offered
        const item = await this.engine.runWork(ctx, {
            action: RECONCILE,
            subject_type: "transaction",
            subject_id: transaction.id,
            lead_id: effect.kind === "apply" ? (first?.candidate.partyKey ?? null) : null,
            inbound_event_id: event.id,
            dedupeKey: `${RECONCILE}:inbound:${event.id}`,
            preset: true,
            ...(effect.kind === "apply" ? {} : { forceAsk: "unclear_outcome" as const }),
            seed: {
                summary: this.kit.text(ctx, "orderPaymentSummary", {
                    amount: this.kit.money(ctx, amount),
                    ref: textOf(event.external_ref) || this.kit.text(ctx, "reconcileNoRef"),
                }),
                amount_vnd: amount,
                outcome: effect.kind === "apply" ? "clear" : "unclear",
                candidates: offered.map((one) => this.proposalCandidate(one.candidate)),
                evidence: [{ key: AMOUNT_EVIDENCE, value: amount, kind: "received", via: "sepay" }],
                fields: {
                    amount_vnd: amount,
                    reference: event.external_ref,
                    payer: null,
                    target: ORDER_TARGET,
                    stage: outcome.stage,
                    reasons,
                    match: reasons,
                },
            },
        })
        await this.evidence.log(ctx, {
            lead_id: item.lead_id,
            work_item_id: item.id,
            kind: "payment.judged",
            actor: "NIVO",
            summary: this.kit.text(ctx, `orderPaymentEnd.${effect.kind}`),
            evidence: reasons,
        })
        return item
    }

    /**
     * The effect of a match, once the gate or the owner approved it: the order is marked paid, the transaction is linked to it, the
     * customer's waiting claims are settled and the customer is told on the channel they wrote from; all of the records in one
     * transaction, so one transaction pays one order and a second attempt changes nothing. An order that no longer waits for money fails
     * the item.
     */
    async settle(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const [chosen] = proposal.candidates ?? []
        if (chosen === undefined || proposal.candidates?.length !== 1) {
            throw new DecisionsError({ code: DecisionsErrorCode.ChooseCandidate })
        }
        const order = await this.orders.find(ctx.workspaceId, chosen.id)
        if (order === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.OrderUnavailable })
        const transactionId = item.subject_type === "transaction" ? item.subject_id : null
        const summary = this.kit.text(ctx, "orderPaymentMatched", {
            amount: this.kit.money(ctx, proposal.amount_vnd ?? order.amount_vnd),
            no: order.order_no,
        })
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.orders.settle(ctx.workspaceId, order.id, tx))) {
                throw new WorkPerformersError({ code: WorkPerformersErrorCode.OrderUnavailable })
            }
            if (transactionId !== null) await this.transactions.matchOrder(ctx.workspaceId, transactionId, order.id, tx)
            await this.claims.settle(ctx.workspaceId, await this.claimIdsOf(ctx, order.lead_id), transactionId, tx)
            if (item.inbound_event_id !== null) {
                await this.inbound.mark(ctx.workspaceId, item.inbound_event_id, null, order.lead_id, tx)
            }
            await this.evidence.log(
                ctx,
                {
                    lead_id: order.lead_id,
                    work_item_id: item.id,
                    kind: "payment.matched",
                    actor: by.name,
                    summary,
                    evidence: textOf(proposal.fields.reasons) || null,
                },
                tx,
            )
        })
        await this.confirm(ctx, order.lead_id, order.order_no, order.amount_vnd)
        return {
            summary,
            evidence: "verified",
            href: leadHref(order.lead_id),
            lead_id: order.lead_id,
            detail: textOf(proposal.fields.reasons) || null,
        }
    }

    /**
     * The end of a claim whose money never came: every open claim older than the configured wait is handed to the owner once, as a
     * work item that asks (the claim is escalated first, so a second tick does not raise it again). Answers how many were raised.
     */
    async raiseOverdue(): Promise<number> {
        const minutes = this.options.claimTimeoutMinutes ?? DEFAULT_CLAIM_TIMEOUT_MINUTES
        const before = new Date(this.clock.now().getTime() - minutes * MINUTE_MS)
        const overdue = await this.claims.overdue(before, OVERDUE_BATCH)
        let raised = 0
        await eachInOrder(overdue, async (claim) => {
            if (!(await this.claims.escalate(claim.workspaceId, claim.id))) return
            await this.raise(claim, minutes)
            raised += 1
        })
        return raised
    }

    private async raise(claim: PaymentClaimRow, minutes: number): Promise<void> {
        const ctx: WorkContext = { workspaceId: claim.workspaceId, actor: "NIVO", locale: "vi" }
        const open = (await this.candidates(ctx, 0)).filter((one) => one.partyKey === claim.leadId)
        const name = open[0]?.partyName ?? (await this.leads.find(ctx.workspaceId, claim.leadId))?.contact_name ?? "—"
        const reasons = this.kit.text(ctx, "orderPaymentOverdue", { name, minutes })
        const item = await this.engine.runWork(ctx, {
            action: RECONCILE,
            subject_type: "lead",
            subject_id: claim.leadId,
            lead_id: claim.leadId,
            dedupeKey: `${RECONCILE}:claim:${claim.id}`,
            preset: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: reasons,
                amount_vnd: claim.amountVnd,
                outcome: "unclear",
                candidates: open.map((one) => this.proposalCandidate(one)),
                fields: { amount_vnd: claim.amountVnd, payer: name, claim: claim.body, target: ORDER_TARGET, reasons },
            },
        })
        await this.evidence.log(ctx, {
            lead_id: claim.leadId,
            work_item_id: item.id,
            kind: "payment.claim_overdue",
            actor: "NIVO",
            summary: reasons,
            evidence: claim.body,
        })
    }

    /** The open orders of the workspace opened since the instant, with the label a person reads. */
    private async candidates(ctx: WorkContext, since: number): Promise<Array<Candidate>> {
        const orders = await this.orders.list(ctx.workspaceId, ORDERS_WINDOW)
        return candidatesOf(orders, since, (order) =>
            this.kit.text(ctx, "candidateLabel", {
                no: order.order_no,
                name: order.contact_name ?? "—",
                amount: this.kit.money(ctx, order.amount_vnd),
            }),
        )
    }

    private proposalCandidate(candidate: Candidate): ProposalCandidate {
        return { id: candidate.id, label: candidate.label, amount_vnd: candidate.amountDue }
    }

    /** The transaction of the credit: the one already recorded for it, else a new unmatched one. */
    private async transactionOf(ctx: WorkContext, event: InboundEventDetail, amount: number) {
        const existing = await this.transactions.ofInboundEvent(ctx.workspaceId, event.id)
        if (existing !== null) return existing
        return this.transactions.open({
            workspaceId: ctx.workspaceId,
            inboundEventId: event.id,
            amountVnd: amount,
            reference: event.external_ref,
            payer: event.sender_name,
        })
    }

    /** The open claims of the customer that the paid order answers. */
    private async claimIdsOf(ctx: WorkContext, leadId: string | null): Promise<Array<string>> {
        if (leadId === null) return []
        const open = (await this.claims.openOf(ctx.workspaceId)).map(claimOf)
        return openClaimsOf(open, leadId).map((claim) => claim.id)
    }

    /** Tells the customer, on the channel they wrote from, that the money arrived; a failure is logged, the order stays paid. */
    private async confirm(ctx: WorkContext, leadId: string | null, orderNo: string, amount: number | null): Promise<void> {
        if (leadId === null) return
        const lead = await this.leads.find(ctx.workspaceId, leadId)
        if (lead === null) return
        try {
            await this.delivery.toCustomer(
                ctx,
                { id: lead.id, contact_name: lead.contact_name, channel: lead.channel },
                this.kit.text(ctx, "orderPaymentConfirmed", { no: orderNo, amount: this.kit.money(ctx, amount) }),
            )
        } catch (cause) {
            this.logger.error(WorkPerformersLogEvent.PaymentConfirmationFailed, cause, { leadId })
        }
    }

    private reasonText(ctx: WorkContext, reason: string): string {
        return REASON_CODES.has(reason) ? this.kit.text(ctx, `orderPaymentReason.${reason}`) : reason
    }
}

