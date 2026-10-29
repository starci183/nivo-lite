import { builder } from "@starci/jest-preset"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type {
    ConversationRow,
    LeadBriefRow,
    LeadRow,
    MessageBriefRow,
    MessageRow,
    WaitingRow,
} from "@modules/domain/chatbot-workbench"

export const MEMBER: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

export const conversationOf = builder<ConversationRow>({
    id: "c-1",
    channel: "zalo",
    visitor_name: null,
    lead_id: "l-1",
    handled_by: null,
    handled_at: null,
    external_id: "zalo-9",
    created_at: "2026-10-13T01:00:00.000Z",
})

export const briefOf = builder<MessageBriefRow>({
    id: "m-1",
    conversation_id: "c-1",
    role: "user",
    body: "Is it in stock?",
    created_at: "2026-10-13T01:00:00.000Z",
})

export const messageOf = builder<MessageRow>({
    ...briefOf(),
    author_kind: null,
    author_name: null,
    delivery_status: null,
    delivery_error: null,
})

export const waitingOf = builder<WaitingRow>({
    id: "w-1",
    subject_id: "c-2",
    proposal: null,
    assigned_staff_id: null,
    created_at: "2026-10-13T02:00:00.000Z",
})

export const LEAD_BRIEF: LeadBriefRow = { id: "l-1", contact_name: "Hoa", created_at: "2026-10-12T00:00:00.000Z" }

export const LEAD: LeadRow = {
    id: "l-1",
    contact_name: "Hoa",
    company: "Hoa Shop",
    stage: "new",
    need: "T-shirts",
    phone: "0901000000",
    email: null,
}

export const GAP: GapRecord = {
    id: "g-1",
    module: "chatbot",
    question: "When does the shop open?",
    topic: null,
    attributeGuess: null,
    count: 3,
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastSeenAt: "2026-10-12T00:00:00.000Z",
    exampleConversationId: "c-1",
    status: "open",
    reopenedCount: 0,
}

/** An installation row as a scenario declares it. */
export interface InstallationRow {
    readonly id: string
    readonly agent_id: string | null
}

/** Whether a stubbed row is a waiting reply. */
export const isWaitingRow = (row: unknown): row is WaitingRow =>
    typeof row === "object" && row !== null && "subject_id" in row

/** Whether a stubbed row is an installation with its agent. */
export const isInstallationRow = (row: unknown): row is InstallationRow =>
    typeof row === "object" && row !== null && "agent_id" in row
