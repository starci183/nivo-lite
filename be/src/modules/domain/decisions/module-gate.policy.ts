import type { ModuleApprovalRequest, GateFieldValue, PerformContext, PerformResult } from "@modules/domain/module-ops"
import type {
    Performed,
    PerformedBy,
    Proposal,
    ProposalFieldValue,
    SubjectType,
    WorkContext,
    WorkItem,
} from "./decisions.contracts"

/** The subject kinds a work item names as they are; any other module subject is recorded as an input, as before. */
const KNOWN_SUBJECTS: ReadonlyArray<SubjectType> = [
    "lead",
    "order",
    "invoice",
    "transaction",
    "conversation",
    "inbound",
    "purchase_order",
    "stock",
    "video_project",
]

/** The work item subject of a module request: a known kind as it is, else `inbound` with the module's own id as the subject id. */
export const subjectTypeOf = (subjectType: string): SubjectType =>
    KNOWN_SUBJECTS.find((known) => known === subjectType) ?? "inbound"

/** A gate fact as a proposal field: a yes/no fact is kept as the text `true` or `false`. */
const proposalFieldOf = (value: GateFieldValue): ProposalFieldValue =>
    typeof value === "boolean" ? String(value) : value

/** The preset proposal of a module request: its summary, draft, amount and facts, judged without a model call. */
export const proposalOf = (request: ModuleApprovalRequest): Proposal => ({
    summary: request.summary,
    ...(request.draft === undefined ? {} : { draft: request.draft }),
    ...(request.amountVnd === undefined ? {} : { amount_vnd: request.amountVnd }),
    fields: Object.fromEntries(
        Object.entries(request.fields).map(([name, value]) => [name, proposalFieldOf(value)] as const),
    ),
})

/** What a module performer receives for a work item the gate or a person let through, with the person's edits merged. */
export const performContextOf = (
    ctx: WorkContext,
    item: WorkItem,
    proposal: Proposal,
    by: PerformedBy,
): PerformContext => ({
    workspaceId: ctx.workspaceId,
    workItemId: item.id,
    actor: by.name,
    draft: proposal.draft ?? null,
    fields: proposal.fields,
})

/** What the engine logs for a module performer's result. */
export const performedOf = (item: WorkItem, result: PerformResult): Performed => ({
    summary: result.summary,
    evidence: result.evidence,
    ...(result.href === undefined ? {} : { href: result.href }),
    lead_id: item.lead_id,
    detail: result.detail ?? null,
})
