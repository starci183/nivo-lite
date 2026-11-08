import type * as Shapes from "./work-engine-shapes.builder"
import type { WorkItemsService } from "@modules/domain/work-items"
import type {
    AuthorityRulesService,
    BranchDivert,
    GateVerdict,
    GraphAnswer,
    GraphCheck,
    AuthorityRule,
} from "@modules/domain/authority-rules"
import {
    type WorkContext,
    type ActionEntry,
    type OutboundAccess,
    type OutboundAccessGate,
    type WorkPerformer,
    type Proposal,
    type WorkItem,
    type Performed,
    type Prepared,
    type ModuleCatalogService,
    type WorkEngineService,
    type WorkSpec,
    DecisionsErrorCode,
} from "@modules/domain/decisions"
import { builder, mock, type MockOf } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"

/** The workspace and actor shared by work-engine scenarios. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
/** The proposal used by default work and performer results. */
export const quote: Proposal = { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 }
/** Builds a queued message proposal with the producer's durable execution choices. */
export const messageProposalOf: (overrides?: Partial<Proposal>) => Proposal = builder<Proposal>({
    ...quote,
    draft: "Exact caller text",
    execution: { preset: true, noChain: true },
})
/** Builds a message whose admission requires an owner's decision. */
export const approvalMessageOf: (overrides?: Partial<Proposal>) => Proposal = builder<Proposal>({
    ...messageProposalOf(),
    execution: { preset: true, noChain: true, forceAsk: "over_authority" },
})

/** Builds a queued work item with scenario-specific overrides. */
export const itemOf: (overrides?: Partial<WorkItem>) => WorkItem = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: quote,
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})
/** Builds the automatic authority rule used by the work engine. */
export const ruleOf: (overrides?: Partial<AuthorityRule>) => AuthorityRule = builder<
    NonNullable<Awaited<ReturnType<AuthorityRulesService["ruleFor"]>>>
>({
    id: "rule-1",
    department: "sales",
    action: "send_quote",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})
/** Builds a catalog action with no successor work. */
export const actionEntry: (overrides?: Partial<ActionEntry>) => ActionEntry = builder<
    NonNullable<Awaited<ReturnType<ModuleCatalogService["actionOf"]>>>
>({
    action: "send_quote",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Gui bao gia", en: "Send quote" },
})
/** Builds a deduplicated live work request. */
export const specOf: (overrides?: Partial<WorkSpec>) => WorkSpec = builder<Parameters<WorkEngineService["runWork"]>[1]>(
    {
        action: "send_quote",
        subject_type: "lead",
        subject_id: "lead-1",
        lead_id: "lead-1",
        dedupeKey: "send_quote:lead-1",
    },
)
/** Builds the captured evidence returned by a successful performer. */
export const performedOf: (overrides?: Partial<Performed>) => Performed = builder<Performed>({
    summary: "Sent the quote",
    evidence: "captured",
})

/** One controlled refusal after work has already committed. */
export interface WorkEngineNotificationFailure {
    readonly target: "finished" | "continueChain" | "rejected"
    readonly cause: Error
}

/** Scenario choices for the work engine and its injected collaborators. */
export interface WorkEngineFixtureOptions {
    readonly performer?: WorkPerformer | null
    readonly rule?: Awaited<ReturnType<AuthorityRulesService["ruleFor"]>>
    readonly access?: OutboundAccess
    readonly action?: ActionEntry | null
    readonly created?: boolean
    readonly items?: Partial<WorkItemsService>
    readonly notificationFailure?: WorkEngineNotificationFailure
}

/** An order awaiting approval whose catalog successor would run without its durable noChain choice. */
export const noChainOrderOptions = (proposal: Proposal): WorkEngineFixtureOptions => ({
    action: actionEntry({ action: "confirm_order", next: ["issue_invoice"] }),
    rule: ruleOf({ action: "confirm_order", mode: "ask" }),
    items: {
        reopen: () =>
            Promise.resolve(
                itemOf({ action: "confirm_order", subject_type: "order", subject_id: "order-1", proposal }),
            ),
    },
})

/** The owner deciding queued work in approval scenarios. */
export const owner = { name: "Lan", kind: "owner" } as const
/** The alternatives returned by an ambiguous payment performer. */
export const candidates: Array<Shapes.CandidatesShape> = [
    { id: "inv-1", label: "One", amount_vnd: 1 },
    { id: "inv-2", label: "Two", amount_vnd: 2 },
]

/** Bounded queue scenarios exercise empty, zero-limit, and fully claimed runs. */
export const queuedRuns: Array<Shapes.QueuedRunsShape | Shapes.QueuedRunsShape2> = [
    { limit: 0, queued: null, count: 0, reads: [] },
    { limit: 3, queued: null, count: 0, reads: [["ws-1"]] },
    { limit: 2, queued: itemOf(), count: 2, reads: [["ws-1"], ["ws-1"]] },
]
/** Failure inputs prove error normalization and bounded stored messages. */
export const performerFailures: Array<Shapes.PerformerFailuresShape | Shapes.PerformerFailuresShape2> = [
    { cause: new RangeError("model down"), message: "model down" },
    { cause: "x".repeat(600), message: "x".repeat(500) },
]
/** A failed approval or rejection must remain visible to its caller. */
export const decisionFailures = [
    ["rejected", "onReject", "undo failed"],
    ["approved", "perform", "send failed"],
] as const
/** Human decisions retain their reviewed proposal and outcome. */
export const approvalCases = [
    ["unchanged", {}, null, "approved", { outcome: "clear" }],
    ["edited", { amount_vnd: 90 }, "cheaper", "edited", { amount_vnd: 90 }],
] as const

/** Requests that do not acquire executable work. */
export const idleRuns: Array<Shapes.IdleRunsShape> = [
    { label: "when deduped", created: false, queue: false, held: false },
    { label: "when queued", created: true, queue: true, held: false },
    { label: "when held", created: true, queue: false, held: true },
]
/** Builds a performer's corrected customer and order address. */
export const preparedOrderOf: (overrides?: Partial<Prepared>) => Prepared = builder<Prepared>({
    proposal: { summary: "Work.Prepared", fields: { items: "tea" } },
    patch: { lead_id: "lead-2", subject_type: "order", subject_id: "order-1" },
})
/** Expected durable address after the performer corrects an order. */
export const preparedAddress: Shapes.PreparedAddressShape = {
    proposal: preparedOrderOf().proposal,
    subjectType: "order",
    subjectId: "order-1",
    leadId: "lead-2",
}
/** The exact source text used by the inbound reply scenario. */
export const replySeed = { summary: "Hi" }
/** The exact inbound identity passed to the engine's source methods. */
export const inboundEvent: Parameters<WorkEngineService["startInboundWork"]>[1] = { id: "event-1" }
/** Expected work identity and source for a customer's inbound reply. */
export const inboundReply: Shapes.InboundReplyShape = {
    action: "reply_customer",
    subject_type: "inbound",
    subject_id: "event-1",
    inbound_event_id: "event-1",
    lead_id: "lead-1",
    dedupeKey: "reply_customer:inbound:event-1",
    seed: replySeed,
}
/** Order source fields retained with and without a linked customer. */
export const orderSeeds: Array<
    Array<string | Shapes.OrderSeedsShape> | Array<string | Shapes.OrderSeedsShape2 | null>
> = [
    ["confirm_order", "lead-2", { amount_vnd: 500, fields: { items: "tea", amount_vnd: 500 } }],
    ["confirm_order", null, { amount_vnd: null, fields: { items: "tea", amount_vnd: null } }],
]
/** Catalogue cases for work whose performer intentionally has no side effect. */
export const recordOnlyCases: Array<Shapes.RecordOnlyCasesShape | Shapes.RecordOnlyCasesShape2> = [
    { label: "with a label", action: actionEntry(), result: { summary: "engine.recordOnly(Send quote)" } },
    { label: "without a label", action: null, result: { summary: "engine.recordOnly(send_quote)" } },
]

/** Queue rows and exact reads/claims for zero, single, and contended inbound batches. */
export const inboundBatches: Array<Shapes.InboundBatchesShape> = [0, 1, 4].map((limit) => {
    const claims = limit === 0 ? [] : [["ws-1", "item-1"]]
    if (limit === 4) claims.unshift(["ws-1", "held-1"])
    return {
        limit,
        queued: [itemOf({ id: limit === 4 ? "held-1" : "item-1" }), itemOf()],
        claimed: limit === 4 ? [null] : [],
        count: limit === 0 ? 0 : 1,
        reads: Array.from({ length: limit === 4 ? 3 : limit }, () => ["ws-1", "event-1"]),
        claims,
    }
})

/** What the gate answers when the graph asked, so the branch alone is the reason. */
export const BRANCH_ASKING: GateVerdict = { verdict: "ask", reason: "branch_ask", reasons: ["branch_ask"], missing: [] }

/** The hand-over a branch names in place of the proposal, with a person to decide it. */
export const HAND_OVER: BranchDivert = { action: "hand_over_conversation", handoverTo: "support", asks: true }

/** What the graph carries to the engine with its verdict. */
export interface GraphCarried {
    readonly proposal: Proposal
    readonly stopped: boolean
    readonly divert: BranchDivert | null
}

/** What the branching service answers for the work. */
export interface GraphOutcome {
    readonly proposal: Proposal
    readonly verdict: GateVerdict
    readonly carried: GraphCarried
}

/** What the branching service answers when the graph stopped the work. */
export const stoppedByGraph = (): GraphOutcome => ({
    proposal: quote,
    verdict: BRANCH_ASKING,
    carried: { proposal: quote, stopped: true, divert: null },
})
/** The same, for the branch that leads to another action. */
export const divertedByGraph = (): GraphOutcome => ({
    proposal: quote,
    verdict: BRANCH_ASKING,
    carried: { proposal: quote, stopped: false, divert: HAND_OVER },
})

/** The work the divert above starts: the same subject, preset, with no chain, and a person asked. */
export const divertedWork: Shapes.DivertedWorkShape = {
    action: "hand_over_conversation",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    dedupeKey: "graph:item-1:hand_over_conversation",
    preset: true,
    noChain: true,
    forceAsk: "branch_ask",
    seed: { ...quote, fields: { ...quote.fields, to: "support" } },
}

/** A reply of a conversation put to the graph, and the answer that stops it. */
export const replyCheck: GraphCheck = {
    workspaceId: "ws-1",
    installationId: null,
    action: "reply_customer",
    road: "reply",
    key: "reply:abc",
    subjectType: "conversation",
    subjectId: "c1",
    leadId: null,
    text: "Hi",
    evidence: null,
    attributes: {},
    turnId: null,
    wakeId: null,
    askOpensWork: true,
}
/** The answer of the graph that stops a reply. */
export const stopAnswer: GraphAnswer = { outcome: "stop", unread: [], unjudged: null, divert: null }

/** The source a diverted action takes its subject from, and the work it starts when the node names no target and nobody asks. */
export const replySource: Parameters<WorkEngineService["runDiverted"]>[2] = {
    key: "m1",
    subjectType: "conversation",
    subjectId: "c1",
    leadId: null,
    installationId: "inst-1",
    origin: { turnId: "turn-1", wakeId: "wake-1" },
    proposal: { summary: "Reply", draft: "Hi", fields: {} },
}

/** The doubles of the engine whose owners export them, arranged with the answers every scenario starts from. */
export interface EngineDoubles {
    readonly catalog: MockOf<MessageCatalog>
    readonly modules: MockOf<ModuleCatalogService>
    readonly items: MockOf<WorkItemsService>
    readonly access: MockOf<OutboundAccessGate>
    readonly rules: MockOf<AuthorityRulesService>
}

/** Gives the doubles their default answers, then the answers the scenario names for the queue. */
export const arrangeEngineDoubles = (options: WorkEngineFixtureOptions, doubles: EngineDoubles): void => {
    const { catalog, modules, items, access, rules } = doubles
    catalog.get.mockImplementation((key, params) => `${key}(${Object.values(params ?? {}).join(",")})`)
    modules.actionOf.mockResolvedValue(options.action === undefined ? actionEntry() : options.action)
    modules.tagRuleOf.mockResolvedValue(ruleOf({ id: "tag:quote", mode: "auto" }))
    items.claim.mockResolvedValue(itemOf())
    items.nextQueued.mockResolvedValue(null)
    items.nextInboundQueued.mockResolvedValue(null)
    items.reopen.mockResolvedValue(itemOf({ status: "queued", reason: "over_authority" }))
    items.savePrepared.mockResolvedValue(itemOf())
    items.markDone.mockResolvedValue(itemOf({ status: "done" }))
    items.markFailed.mockResolvedValue(itemOf({ status: "failed" }))
    items.markRejected.mockResolvedValue(itemOf({ status: "rejected" }))
    Object.assign(items, options.items)
    access.accessOf.mockResolvedValue(options.access ?? "auto")
    rules.ruleFor.mockResolvedValue(options.rule === undefined ? ruleOf() : options.rule)
}

/** What the engine spec reads of a finished scenario without the driver. */
export const autoPlan = { path: "auto", by: { name: "NIVO", kind: "policy" }, outcome: "auto_done" }

/** The stored result and address shared by successful execution scenarios. */
export const autoResult = { path: "auto", result: { summary: "Sent the quote" }, evidence: "captured", leadId: null }
/** The saved address when preparation corrects no subject or customer. */
export const blankPatch: Shapes.BlankPatchShape = { proposal: quote, subjectType: null, subjectId: null, leadId: null }
/** The retained link and customer of a delivered quote. */
export const linkedQuoteResult = {
    result: { summary: "Sent the quote", href: "/quotes/1" },
    leadId: "lead-9",
}
/** The system identity recorded when a graph rejects work. */
export const graphDecider = { name: "NIVO", kind: "staff" }
/** Both graph outcomes retain their exact close note and insertion count. */
export const graphClosures: readonly [
    readonly ["stopped", () => GraphOutcome, "engine.graphStopped()", 1],
    readonly ["diverted", () => GraphOutcome, "engine.graphDiverted()", 2],
] = [
    ["stopped", stoppedByGraph, "engine.graphStopped()", 1],
    ["diverted", divertedByGraph, "engine.graphDiverted()", 2],
] as const
/** A diverted reply keeps its original conversation without adding an approval. */
export const unaskedDivertedWork: Shapes.UnaskedDivertedWorkShape = {
    subject_id: "c1",
    dedupeKey: "graph:m1:hand_over_conversation",
    origin: replySource.origin,
    seed: { summary: "Reply", draft: "Hi", fields: { conversation_id: "c1" } },
}
/** The queued addresses of a successful claim followed by a contended one. */
export const queuedContentionReads: Array<Array<string>> = [
    ["ws-1", "a"],
    ["ws-1", "b"],
]
/** The durable waiting state when a reviewed proposal still lacks a field. */
export const stillMissingData: Shapes.StillMissingDataShape = {
    proposal: quote,
    missing: ["need"],
    reason: "missing_data",
    reasons: ["missing_data"],
}
/** The existing approval whose final state remains closed after notification failure. */
export const doneState = { status: "done" }
/** The authority answer when a producer forces work to ask. */
export const unclearGate: Shapes.UnclearGateShape = {
    verdict: { verdict: "ask", reason: "unclear_outcome", reasons: ["unclear_outcome"], missing: [] },
    rule: ruleOf(),
}
const durablePrepared: Proposal = { summary: "Prepared", fields: { items: "coffee" } }
/** The input, preparation and exact saved durable execution choices. */
export const durablePreparation: Shapes.DurablePreparationShape = {
    proposal: { ...quote, execution: { noChain: true } },
    prepared: durablePrepared,
    saved: {
        ...blankPatch,
        proposal: { ...durablePrepared, execution: { preset: undefined, noChain: true, forceAsk: undefined } },
    },
}

/** Arranges a queued preset that is returned and claimed with the same proposal. */
export const queuedPresetOptions = (proposal: Proposal): WorkEngineFixtureOptions => {
    const items = mock<Pick<WorkItemsService, "nextQueued" | "claim">>()
    items.nextQueued.mockResolvedValue(itemOf({ proposal }))
    items.claim.mockResolvedValue(itemOf({ proposal }))
    return { items: { nextQueued: items.nextQueued, claim: items.claim } }
}
/** Arranges classification work whose outbound-access reader must remain unused. */
export const classificationOptions = (): WorkEngineFixtureOptions => {
    const items = mock<Pick<WorkItemsService, "claim">>()
    items.claim.mockResolvedValue(itemOf({ action: "classify_lead" }))
    return { action: actionEntry({ action: "classify_lead" }), items: { claim: items.claim } }
}
/** The preset classification request paired with its catalog action. */
export const classificationSpec = { action: "classify_lead", preset: true }
/** Arranges the queue losing its second claim to another worker. */
export const arrangeQueuedContention = (items: MockOf<WorkItemsService>): void => {
    items.claim.mockResolvedValueOnce(itemOf({ id: "a" })).mockResolvedValueOnce(null)
    items.nextQueued.mockResolvedValueOnce(itemOf({ id: "a" })).mockResolvedValueOnce(itemOf({ id: "b" }))
}
/** The ambiguous payment shared by candidate-decision scenarios. */
export const candidateProposal: Proposal = { summary: "Pay", fields: {}, candidates }
/** Arranges the ambiguous payment before a person has selected a candidate. */
export const ambiguousCandidateOptions = (): WorkEngineFixtureOptions => {
    const items = mock<Pick<WorkItemsService, "reopen">>()
    items.reopen.mockResolvedValue(itemOf({ proposal: candidateProposal, reason: "unclear_outcome" }))
    return { items: { reopen: items.reopen } }
}
/** Arranges the candidate approval with the existing waiting payment and ask rule. */
export const chosenCandidateOptions = (): WorkEngineFixtureOptions => {
    const items = mock<Pick<WorkItemsService, "reopen">>()
    items.reopen.mockResolvedValue(itemOf({ proposal: candidateProposal }))
    return { rule: ruleOf({ mode: "ask" }), items: { reopen: items.reopen } }
}

/** Exact event arguments for automatic completion scenarios. */
export const autoFinishArgsOf = (
    item: unknown,
    done: unknown,
    proposal: unknown,
): readonly [WorkContext, unknown, unknown, unknown, Shapes.AutoFinishArgsOfResultShape, Performed] =>
    [ctx, item, done, proposal, autoPlan, performedOf()] as const
/** Exact event arguments for a completion already recorded in the decision transaction. */
export const recordedFinishArgsOf = (
    item: unknown,
    done: unknown,
    proposal: unknown,
    plan: unknown,
    result: unknown = performedOf(),
): readonly [WorkContext, unknown, unknown, unknown, unknown, unknown, true] =>
    [ctx, item, done, proposal, plan, result, true] as const
/** Exact graph-rejection event data, with the scenario's item matcher and close note. */
export const graphRejectionArgsOf = (
    item: unknown,
    note: unknown,
): readonly [WorkContext, unknown, Proposal, Shapes.GraphRejectionArgsOfResultShape, unknown, true] =>
    [ctx, item, quote, graphDecider, note, true] as const
/** Exact stored rejection of the edited draft, with the transaction-manager matcher supplied by the spec. */
export const rejectionMarkArgsOf = (
    manager: unknown,
): readonly ["item-1", Shapes.RejectionMarkArgsOfResultShape, Shapes.RejectionMarkArgsOfResultShape2, unknown] =>
    ["item-1", { ...quote, draft: "x" }, { summary: "engine.rejectedResult()" }, manager] as const
/** Exact authoritative completion data before its post-commit notifications. */
export const authoritativeFinishArgsOf = (
    manager: unknown,
    item: unknown,
    done: unknown,
    proposal: unknown,
    plan: unknown,
): readonly [unknown, WorkContext, unknown, unknown, unknown, unknown, Performed] =>
    [manager, ctx, item, done, proposal, plan, performedOf()] as const
/** Both automatic notification boundaries must surface their own failure. */
export const autoNotificationFailures: Array<
    Shapes.AutoNotificationFailuresShape | Shapes.AutoNotificationFailuresShape2
> = [
    { target: "finished", cause: new Error("office-unavailable") },
    { target: "continueChain", cause: new Error("chain-unavailable") },
] satisfies ReadonlyArray<NonNullable<WorkEngineFixtureOptions["notificationFailure"]>>
/** A rejected human decision whose Office notification fails after commit. */
export const rejectedNotificationFailure: Shapes.RejectedNotificationFailureShape = {
    target: "rejected",
    cause: new Error("rejection-office-unavailable"),
} satisfies NonNullable<WorkEngineFixtureOptions["notificationFailure"]>
/** Selects one controlled post-close notification refusal. */
export const notificationOptions = (
    failure: NonNullable<WorkEngineFixtureOptions["notificationFailure"]>,
): WorkEngineFixtureOptions => ({ notificationFailure: failure })

/** The unchanged authority and refusal facts asserted by engine scenarios. */
export const overAuthorityVerdict = { verdict: "ask", reason: "over_authority" }
export const missingFieldsError: Shapes.MissingFieldsErrorShape = {
    code: DecisionsErrorCode.StillMissing,
    params: { fields: "Need" },
}
export const chooseCandidateError: Shapes.ChooseCandidateErrorShape = { code: DecisionsErrorCode.ChooseCandidate }
/** Expected ask data; matchers remain owned and created by the spec. */
export const durableAskArgsOf = (
    item: unknown,
    proposal: Proposal,
    gate: unknown,
): readonly [WorkContext, unknown, Proposal, unknown] => [ctx, item, proposal, gate] as const
/** Expected atomic rejection data, retaining the exact manager and owner principal. */
export const authoritativeRejectionArgsOf = (
    manager: unknown,
    item: unknown,
): readonly [unknown, WorkContext, unknown, Proposal, Shapes.AuthoritativeRejectionArgsOfResultShape, null] =>
    [manager, ctx, item, quote, owner, null] as const
