import { builder } from "@starci/jest-preset"
import type { LeadRecordRow } from "@modules/domain/leads"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The active workspace owner requesting a queued lead action. */
export const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
})

/** The customer addressed by queued lead actions. */
export const leadOf = builder<LeadRecordRow>({
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
})
