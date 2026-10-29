import type { PipelineRow } from "@modules/domain/automation-pipelines"
import type { WorkItem } from "@modules/domain/decisions"
import type { Shift } from "@modules/domain/shifts"
import { itemOf as decisionItemOf } from "./work-decision.builder"

/** A shift of the week as the rules read it, with the fields a spec changes overridden. */
export const shiftOf = (overrides: Partial<Shift> = {}): Shift => ({
    id: "shift-1",
    date: "2026-10-14",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "profile-1",
    status: "published",
    ...overrides,
})

/** A finished work item with the fields a spec changes overridden. */
export const itemOf = (overrides: Partial<WorkItem> = {}): WorkItem =>
    decisionItemOf({ status: "done", proposal: { summary: "", fields: {} }, ...overrides })

/** The reminder pipeline the owner of automations answers; the specs set its switch. */
export const PIPELINE: PipelineRow = {
    id: "pipeline-1",
    workspace_id: "ws-1",
    template_key: "shifts_shift_reminder",
    name: "Reminder",
    module_key: "shifts",
    enabled: true,
    dismissed: false,
    config: {},
    body: null,
    body_version: 0,
    template_version: 1,
    based_on_context: null,
    approval_streak: 0,
    trust_offered_at: null,
    auto_send: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
}

/** The pending swap of the rows builder as the bench lists it. */
export const PENDING_SWAP_VIEW = {
    id: "swap-1",
    kind: "swap",
    shiftId: "shift-1",
    fromStaffId: "profile-1",
    toStaffId: "profile-2",
    reason: "Exam",
    status: "pending",
    checks: [],
    workItemId: null,
    createdAt: "2026-10-13T03:00:00.000Z",
    item: null,
    shiftLine: "14/10 08:00–10:00 Cashier",
}

/** The approved weekly statement of the rows builder as the bench lists it. */
export const APPROVED_STATEMENT_VIEW = {
    id: "avail-1",
    staffId: "profile-1",
    weekday: 2,
    date: null,
    start: "08:00",
    end: "12:00",
    available: false,
    note: "School",
    status: "approved",
    createdAt: "2026-10-01T00:00:00.000Z",
}
