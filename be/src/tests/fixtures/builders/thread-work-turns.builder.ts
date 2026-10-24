import type { ApprovalSetup } from "@modules/domain/authority-rules"
import type { ActionEntry, ModuleCommand, WorkItem } from "@modules/domain/decisions"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import type { ThreadWorkRow, WorkAgentRow } from "../../../modules/domain/thread-work/persistence/thread-work.rows"
import {
    INSERT_THREAD_WORK,
    LIST_WORK_AGENTS,
    UPDATE_THREAD_WORK,
} from "../../../modules/domain/thread-work/persistence/thread-work.sql"

/** The sales agent that can pass work to Accounting. */
const SALES_AI = {
    id: "agent-sales",
    name: "AI Sales",
    module: "sales",
    canTag: ["agent-accounting"],
}
/** The active Accounting receiver returned by the database. */
export const ACCOUNTING_ROW: WorkAgentRow = {
    id: "agent-accounting",
    name: "Ke toan AI",
    module: "accounting",
    can_tag_agent_ids: [],
}

/** The address and language of the sales step. */
export const PLACE = {
    workspaceId: "ws-1",
    threadId: "thread-1",
    workId: "work-1",
    agent: SALES_AI,
    locale: "vi" as const,
}
/** The receiving module commands from the shipped bilingual catalog. */
export const COMMANDS: ReadonlyArray<ModuleCommand> =
    MODULE_CATALOG.find((module) => module.key === "accounting")?.accepts ?? []

/** The action registry used by the thread scenarios. */
export const ENTRIES: Readonly<Record<string, ActionEntry>> = {
    give_discount: {
        action: "give_discount",
        moduleKey: "sales",
        maxMode: null,
        next: ["issue_invoice", "gone_action"],
        label: { vi: "Giam gia", en: "Give discount" },
    },
    issue_invoice: {
        action: "issue_invoice",
        moduleKey: "accounting",
        maxMode: null,
        next: [],
        label: { vi: "Xuat hoa don", en: "Issue invoice" },
    },
}

/** The discount approval setup used by the thread scenarios. */
export const SETUP: ApprovalSetup = {
    department: "sales",
    action: "give_discount",
    mode: "auto",
    unit: "percent",
    auto_max: 3,
    ask_max: 15,
    group: { roles: ["manager"], rooms: ["sales"], members: [] },
    policy: "any",
    timeout_minutes: 30,
    agents: [],
}

/** Builds the persisted state of a thread step. */
export const rowOf = (state: ThreadWorkRow["state"]): ThreadWorkRow => ({
    id: "work-1",
    workspace_id: "ws-1",
    thread_id: "thread-1",
    work_item_id: "item-1",
    agent_id: "agent-sales",
    state,
    approval_request_id: null,
    waiting_member_id: null,
    missing_fields: [],
})

/** A discount waiting for a manager decision. */
export const DISCOUNT: WorkItem = itemOf({
    action: "give_discount",
    status: "waiting_decision",
    reason: "over_authority",
    proposal: {
        summary: "Giam 8% cho chi Thao",
        amount_vnd: 6_440_000,
        fields: { customer: "Chi Thao", amount_percent: 8 },
    },
})

/** Optional response data supplied to the spec doubles. */
export interface Doubles {
    readonly commands?: ReadonlyArray<ModuleCommand>
    readonly inserted?: ReadonlyArray<ThreadWorkRow>
    readonly setup?: ApprovalSetup | null
    readonly stopped?: "limit" | "loop" | null
    readonly requestId?: string | null
}

/** The rows the database double answers for each statement. */
export const stubsOf = (inserted: ReadonlyArray<ThreadWorkRow>) => ({
    query: [
        [INSERT_THREAD_WORK, inserted],
        [LIST_WORK_AGENTS, [ACCOUNTING_ROW]],
        [UPDATE_THREAD_WORK, []],
    ] as const,
})

/** The structured customer assignment given to Sales. */
export const STEP = {
    workspaceId: "ws-1",
    threadId: "thread-1",
    agent: SALES_AI,
    action: "give_discount",
    leadId: "lead-thao",
    seed: { summary: "Giam 8%", amount_vnd: 6_440_000, fields: { customer: "Chi Thao", amount_percent: 8 } },
    parentId: null,
    actorName: "Lan",
}

/** The persisted transition arguments expected by thread scenarios. */
export const moved = (
    state: string,
    requestId: string | null = null,
    memberId: string | null = null,
    missing: Array<string> = [],
) => ["ws-1", "work-1", state, requestId, memberId, missing]

/** A neighboring command that must not be chosen for invoice work. */
export const unrelated: ModuleCommand = {
    command: "another_command",
    action: "another_action",
    subjectType: "order",
    requiredFields: [],
    description: { vi: "Another action", en: "Another action" },
}
