import { Injectable } from "@nestjs/common"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkItemsService } from "@modules/domain/work-items"
import type { OptionalWorkItem } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    Decider,
    GateVerdict,
    InboundEventRecord,
    OptionalAuthorityRule,
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkEdits,
    WorkItem,
    WorkPerformer,
    WorkSpec,
} from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { evaluateGate } from "./gate.policy"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkChainService } from "./work-chain.service"
import type {
    FinishPlan,
    Finisher,
    Judgement,
    OptionalText,
    OrderStart,
    ProcessOptions,
    ProposalSeed,
    ResumeDecision,
} from "./work-engine.contracts"
import { InjectOutboundAccessGate } from "./work-engine.decorators"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import {
    accessLetsRunAlone,
    askBecause,
    blockingReasons,
    failureText,
    isCustomerOutbound,
    mergeEdits,
    reviewedByPerson,
} from "./work-engine.policy"
import type { OutboundAccessGate } from "./work-engine.port"
import { WorkIntakeService } from "./work-intake.service"
import { InjectWorkPerformerRegistry } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"

/** The decider of every automatic path. */
const NIVO_BY: Finisher = { name: "NIVO", kind: "policy" }

@Injectable()
/**
 * The NIVO work engine. Every AI step is a work item that passes the policy gate: it either completes by itself (the decision
 * logged as policy) or waits for a person and resumes the same work afterwards. Nothing here depends on a request, so the
 * caller decides what runs after the response: `runWork` returns the item, and an item inserted with `queue: true` waits for
 * `runQueued`.
 */
export class WorkEngineService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectOutboundAccessGate() private readonly access: OutboundAccessGate,
        private readonly items: WorkItemsService,
        private readonly modules: ModuleCatalogService,
        private readonly rules: AuthorityRulesService,
        private readonly intake: WorkIntakeService,
        private readonly chain: WorkChainService,
        private readonly approval: WorkApprovalService,
        private readonly recorder: WorkRecorderService,
    ) {}

    /**
     * The one entry point for every AI step: dedupe, prepare (at most one model call), gate, perform and log, or ask. A second
     * call with the same dedupe key returns the existing item and logs `core.duplicate_blocked`.
     */
    async runWork(ctx: WorkContext, spec: WorkSpec): Promise<WorkItem> {
        const { item, created } = await this.intake.insert(ctx, spec)
        if (!created || spec.queue === true) return item
        const claimed = await this.items.claim(ctx.workspaceId, item.id)
        if (claimed === null) return item
        return this.process(ctx, claimed, { preset: spec.preset, noChain: spec.noChain, forceAsk: spec.forceAsk })
    }

    /** Queues the next department's step for a finished item. */
    async continueChain(ctx: WorkContext, item: WorkItem): Promise<void> {
        await this.chain.continueChain(ctx, item)
    }

    /** Processes up to `limit` queued chain steps, oldest first; answers how many ran. */
    runQueued(ctx: WorkContext, limit: number): Promise<number> {
        return this.drain(ctx, limit, 0)
    }

    /** Runs the requested queued item before any older workspace chain steps consume the drain budget. */
    async runQueuedItem(ctx: WorkContext, workItemId: string): Promise<OptionalWorkItem> {
        const claimed = await this.items.claim(ctx.workspaceId, workItemId)
        return claimed === null ? null : this.process(ctx, claimed, {})
    }

    /**
     * The decision resumes the same work: guarded transition (double clicks are safe), the person's edits merged, a rejection
     * stops the work with the action's undo, an approval goes through the gate with `humanApproved`, performs, logs and
     * continues the chain.
     */
    async resumeWork(
        ctx: WorkContext,
        workItemId: string,
        decision: ResumeDecision,
        edits: WorkEdits,
        by: Decider,
        note: OptionalText = null,
    ): Promise<WorkItem> {
        const item = await this.items.reopen(ctx.workspaceId, workItemId)
        if (item === null) throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        const merged = mergeEdits(item.proposal, edits)
        if (decision === "rejected") return this.reject(ctx, item, merged.proposal, by, note)
        return this.approve(ctx, item, merged.proposal, merged.changed, by, note)
    }

    /** Starts the department's work for one recorded input: the same path for simulated and live inputs. */
    startInboundWork(
        ctx: WorkContext,
        event: InboundEventRecord,
        action: string,
        seed: ProposalSeed,
        leadId: OptionalText,
    ): Promise<WorkItem> {
        return this.runWork(ctx, {
            action,
            subject_type: "inbound",
            subject_id: event.id,
            inbound_event_id: event.id,
            lead_id: leadId,
            origin: event.origin,
            dedupeKey: `${action}:inbound:${event.id}`,
            seed,
        })
    }

    /** An order input goes to Sales `confirm_order` through the gate (then Accounting `issue_invoice` by the chain). */
    startOrderWork(ctx: WorkContext, event: InboundEventRecord, order: OrderStart): Promise<WorkItem> {
        return this.startInboundWork(
            ctx,
            event,
            "confirm_order",
            { amount_vnd: order.amount_vnd, fields: { items: order.items, amount_vnd: order.amount_vnd } },
            order.lead_id ?? null,
        )
    }

    private async drain(ctx: WorkContext, remaining: number, done: number): Promise<number> {
        if (remaining <= 0) return done
        const candidate = await this.items.nextQueued(ctx.workspaceId)
        if (candidate === null) return done
        const claimed = await this.items.claim(ctx.workspaceId, candidate.id)
        if (claimed === null) return this.drain(ctx, remaining - 1, done)
        await this.process(ctx, claimed, {})
        return this.drain(ctx, remaining - 1, done + 1)
    }

    /** One pass of the gate over a claimed item: prepare, judge, then perform or ask. Any failure fails the item. */
    private async process(ctx: WorkContext, claimed: WorkItem, opts: ProcessOptions): Promise<WorkItem> {
        let current = claimed
        try {
            const performer = this.registry.performerOf(current.action)
            let proposal = current.proposal
            if (opts.preset !== true) {
                const prepared = await this.prepare(ctx, performer, current)
                proposal = prepared.proposal
                current = await this.items.savePrepared(current.id, {
                    proposal,
                    subjectType: prepared.patch?.subject_type ?? null,
                    subjectId: prepared.patch?.subject_id ?? null,
                    leadId: prepared.patch?.lead_id ?? null,
                })
            }
            const judgement = await this.judge(ctx, current, proposal, opts)
            if (judgement.verdict.verdict === "ask") return await this.approval.ask(ctx, current, proposal, judgement)
            const plan: FinishPlan = { path: "auto", by: NIVO_BY, outcome: "auto_done" }
            return await this.finish(ctx, performer, current, proposal, plan, opts.noChain === true)
        } catch (cause) {
            return this.fail(ctx, current, cause)
        }
    }

    private prepare(ctx: WorkContext, performer: WorkPerformer | null, item: WorkItem): Promise<Prepared> {
        return performer === null ? Promise.resolve({ proposal: item.proposal }) : performer.prepare(ctx, item)
    }

    /** What the performer did; an action without a performer only records the decision. */
    private async perform(
        ctx: WorkContext,
        performer: WorkPerformer | null,
        item: WorkItem,
        proposal: Proposal,
        by: Finisher,
    ): Promise<Performed> {
        if (performer !== null) return performer.perform(ctx, item, proposal, by)
        const action = (await this.modules.actionOf(item.action))?.label[ctx.locale] ?? item.action
        return {
            summary: this.catalog.get("engine.recordOnly", { action }, ctx.locale),
            evidence: "pending",
            lead_id: item.lead_id,
        }
    }

    /** The gate's verdict, tightened by a forced ask and by the agent access of the connection the message leaves through. */
    private async judge(
        ctx: WorkContext,
        item: WorkItem,
        proposal: Proposal,
        opts: ProcessOptions,
    ): Promise<Judgement> {
        const rule = await this.rules.ruleFor(ctx, item.action, item.installation_id)
        const base = await this.gate(item, rule, proposal, false)
        const forced = opts.forceAsk === undefined ? base : askBecause(base, opts.forceAsk)
        if (forced.verdict !== "auto" || !isCustomerOutbound(item.action)) return { verdict: forced, rule }
        const access = await this.access.accessOf(ctx, item, proposal)
        return { verdict: accessLetsRunAlone(access) ? forced : askBecause(forced, "over_authority"), rule }
    }

    private async gate(
        item: WorkItem,
        rule: OptionalAuthorityRule,
        proposal: Proposal,
        humanApproved: boolean,
    ): Promise<GateVerdict> {
        const entry = await this.modules.actionOf(item.action)
        return evaluateGate({ action: item.action, rule, maxMode: entry?.maxMode ?? null, proposal, humanApproved })
    }

    /** Performs the work once the gate or a person allowed it, closes the item, writes the logs and continues the chain. */
    private async finish(
        ctx: WorkContext,
        performer: WorkPerformer | null,
        item: WorkItem,
        proposal: Proposal,
        plan: FinishPlan,
        noChain: boolean,
    ): Promise<WorkItem> {
        const res = await this.perform(ctx, performer, item, proposal, plan.by)
        const done = await this.items.markDone(item.id, {
            path: plan.path,
            proposal,
            result: { summary: res.summary, ...(res.href === undefined ? {} : { href: res.href }) },
            evidence: res.evidence,
            leadId: res.lead_id ?? null,
        })
        await this.recorder.finished(ctx, item, done, proposal, plan, res)
        if (!noChain) await this.continueChain(ctx, done)
        return done
    }

    /** Marks the item failed and tells the log, the Office and the inbound event; none of those can fail the failure. */
    private async fail(ctx: WorkContext, item: WorkItem, cause: unknown): Promise<WorkItem> {
        const text = failureText(cause)
        const failed = await this.markFailed(item, text)
        await this.recorder.failed(ctx, item, text)
        return failed
    }

    private async markFailed(item: WorkItem, text: string): Promise<WorkItem> {
        try {
            return await this.items.markFailed(item.id, text)
        } catch (cause) {
            this.logger.error(WorkEngineLogEvent.MarkFailedFailed, cause, { workItemId: item.id })
            return { ...item, status: "failed", error: text }
        }
    }

    private async reject(
        ctx: WorkContext,
        item: WorkItem,
        merged: Proposal,
        by: Decider,
        note: string | null,
    ): Promise<WorkItem> {
        try {
            await this.registry.performerOf(item.action)?.onReject?.(ctx, item, merged, by)
            const rejected = await this.items.markRejected(item.id, merged, {
                summary: this.catalog.get("engine.rejectedResult", {}, ctx.locale),
            })
            await this.recorder.rejected(ctx, item, merged, by, note)
            return rejected
        } catch (cause) {
            await this.fail(ctx, item, cause)
            throw cause
        }
    }

    private async approve(
        ctx: WorkContext,
        item: WorkItem,
        merged: Proposal,
        changed: boolean,
        by: Decider,
        note: string | null,
    ): Promise<WorkItem> {
        const reviewed = reviewedByPerson(merged)
        const rule = await this.rules.ruleFor(ctx, item.action, item.installation_id)
        // humanApproved covers THIS item only (its own action, department and amount): an approval never carries to the next step.
        const verdict = await this.gate(item, rule, reviewed, true)
        const [blocking] = blockingReasons(verdict.reasons)
        if (blocking !== undefined) {
            await this.items.markStillWaiting(item.id, {
                proposal: { ...merged, candidates: item.proposal.candidates },
                missing: verdict.missing,
                reason: blocking,
                reasons: verdict.reasons,
            })
            throw this.stillBlocked(ctx, verdict)
        }
        const plan: FinishPlan = {
            path: "human",
            by,
            outcome: changed ? "edited" : "approved",
            note,
            before: item.proposal,
        }
        try {
            return await this.finish(ctx, this.registry.performerOf(item.action), item, reviewed, plan, false)
        } catch (cause) {
            await this.fail(ctx, item, cause)
            throw cause
        }
    }

    /** The approval cannot supply what is missing or choose the candidate: say which. */
    private stillBlocked(ctx: WorkContext, verdict: GateVerdict): DecisionsError {
        if (verdict.missing.length === 0) return new DecisionsError({ code: DecisionsErrorCode.ChooseCandidate })
        return new DecisionsError({
            code: DecisionsErrorCode.StillMissing,
            params: { fields: this.approval.fieldLabels(ctx, verdict.missing) },
        })
    }
}
