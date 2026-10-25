import { builder } from "@starci/jest-preset"
import type { WorkItemsService } from "@modules/domain/work-items"
import type { AuthorityRulesService } from "@modules/domain/authority-rules"
import type {
    WorkContext,
    ActionEntry,
    OutboundAccess,
    WorkPerformer,
    Proposal,
    WorkItem,
    Performed,
    Prepared,
    ModuleCatalogService,
    WorkEngineService,
} from "@modules/domain/decisions"

/** The workspace and actor shared by work-engine scenarios. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
/** The proposal used by default work and performer results. */
export const quote: Proposal = { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 }
/** Builds a queued message proposal with the producer's durable execution choices. */
export const messageProposalOf = builder<Proposal>({
    ...quote,
    draft: "Exact caller text",
    execution: { preset: true, noChain: true },
})

/** Builds a message whose admission requires an owner's decision. */
export const approvalMessageOf = builder<Proposal>({
    ...messageProposalOf(),
    execution: { preset: true, noChain: true, forceAsk: "over_authority" },
})

/** Builds a queued work item with scenario-specific overrides. */
export const itemOf = builder<WorkItem>({
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
export const ruleOf = builder<NonNullable<Awaited<ReturnType<AuthorityRulesService["ruleFor"]>>>>({
    id: "rule-1",
    department: "sales",
    action: "send_quote",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})
/** Builds a catalog action with no successor work. */
export const actionEntry = builder<NonNullable<Awaited<ReturnType<ModuleCatalogService["actionOf"]>>>>({
    action: "send_quote",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Gui bao gia", en: "Send quote" },
})
/** Builds a deduplicated live work request. */
export const specOf = builder<Parameters<WorkEngineService["runWork"]>[1]>({
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    dedupeKey: "send_quote:lead-1",
})
/** Builds the captured evidence returned by a successful performer. */
export const performedOf = builder<Performed>({ summary: "Sent the quote", evidence: "captured" })

/** Scenario choices for the work engine and its injected collaborators. */
export interface WorkEngineFixtureOptions {
    readonly performer?: WorkPerformer | null
    readonly rule?: Awaited<ReturnType<AuthorityRulesService["ruleFor"]>>
    readonly access?: OutboundAccess
    readonly action?: ActionEntry | null
    readonly created?: boolean
    readonly items?: Partial<WorkItemsService>
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
export const candidates = [
    { id: "inv-1", label: "One", amount_vnd: 1 },
    { id: "inv-2", label: "Two", amount_vnd: 2 },
]

/** Bounded queue scenarios exercise empty, zero-limit, and fully claimed runs. */
export const queuedRuns = [
    { limit: 0, queued: null, count: 0, reads: [] },
    { limit: 3, queued: null, count: 0, reads: [["ws-1"]] },
    { limit: 2, queued: itemOf(), count: 2, reads: [["ws-1"], ["ws-1"]] },
]
/** Failure inputs prove error normalization and bounded stored messages. */
export const performerFailures = [
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
export const idleRuns = [
    { label: "when deduped", created: false, queue: false, held: false },
    { label: "when queued", created: true, queue: true, held: false },
    { label: "when held", created: true, queue: false, held: true },
]
/** Builds a performer's corrected customer and order address. */
export const preparedOrderOf = builder<Prepared>({
    proposal: { summary: "Work.Prepared", fields: { items: "tea" } },
    patch: { lead_id: "lead-2", subject_type: "order", subject_id: "order-1" },
})
/** Expected durable address after the performer corrects an order. */
export const preparedAddress = {
    proposal: preparedOrderOf().proposal,
    subjectType: "order",
    subjectId: "order-1",
    leadId: "lead-2",
}
/** The exact source text used by the inbound reply scenario. */
export const replySeed = { summary: "Hi" }
/** Expected work identity and source for a customer's inbound reply. */
export const inboundReply = {
    action: "reply_customer",
    subject_type: "inbound",
    subject_id: "event-1",
    inbound_event_id: "event-1",
    lead_id: "lead-1",
    dedupeKey: "reply_customer:inbound:event-1",
    seed: replySeed,
}
/** Order source fields retained with and without a linked customer. */
export const orderSeeds = [
    ["confirm_order", "lead-2", { amount_vnd: 500, fields: { items: "tea", amount_vnd: 500 } }],
    ["confirm_order", null, { amount_vnd: null, fields: { items: "tea", amount_vnd: null } }],
]
/** Catalogue cases for work whose performer intentionally has no side effect. */
export const recordOnlyCases = [
    { label: "with a label", action: actionEntry(), result: { summary: "engine.recordOnly(Send quote)" } },
    { label: "without a label", action: null, result: { summary: "engine.recordOnly(send_quote)" } },
]

/** Queue rows and exact reads/claims for zero, single, and contended inbound batches. */
export const inboundBatches = [0, 1, 4].map((limit) => {
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
