import { builder } from "@starci/jest-preset"
import type { AuthorityRulesService } from "@modules/domain/authority-rules"
import type {
    WorkContext,
    Proposal,
    WorkItem,
    Performed,
    ModuleCatalogService,
    WorkEngineService,
} from "@modules/domain/decisions"

/** The workspace and actor shared by work-engine scenarios. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
/** The proposal used by default work and performer results. */
export const quote: Proposal = { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 }
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
    origin: "live",
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
    origin: "live",
})
/** Builds the captured evidence returned by a successful performer. */
export const performedOf = builder<Performed>({ summary: "Sent the quote", evidence: "captured" })
