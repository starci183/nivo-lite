import { builder } from "@starci/jest-preset"
import type { WorkItem } from "@modules/domain/decisions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { answerConversationId, replyBody, requireHandlingAccess } from "./chatreply.policy"
import { ChatreplyError, ChatreplyErrorCode } from "./errors/chatreply.error"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "staff-1",
    displayName: "An",
    status: "active",
})

const itemOf = builder<WorkItem>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "reply_customer",
    subject_type: "conversation",
    subject_id: "legacy-conversation",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Reply", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("replyBody", () => {
    it("trims the reply and preserves its interior whitespace", () => {
        expect(replyBody(" \n Hello  customer \t")).toBe("Hello  customer")
    })

    it("accepts exactly 4000 characters after trimming", () => {
        const body = "x".repeat(4000)
        expect(replyBody(` ${body} `)).toBe(body)
    })

    it.each([" \n\t", "x".repeat(4001)])("refuses an empty or oversized body", (body) => {
        expect(() => replyBody(body)).toThrow(new ChatreplyError({ code: ChatreplyErrorCode.InvalidBody }))
    })
})

describe("requireHandlingAccess", () => {
    it.each([null, "OpenClaw", "An"])("permits staff when the conversation is held by %s", (holder) => {
        expect(requireHandlingAccess(memberOf(), holder)).toBeUndefined()
    })

    it.each(["owner", "manager"] as const)("permits %s to reassign another holder", (role) => {
        expect(requireHandlingAccess(memberOf({ role }), "Other")).toBeUndefined()
    })

    it("refuses staff trying to change another person's conversation", () => {
        expect(() => requireHandlingAccess(memberOf(), "Other")).toThrow(
            new ChatreplyError({ code: ChatreplyErrorCode.HeldByOther }),
        )
    })
})

describe("answerConversationId", () => {
    const legacyFields: ReadonlyArray<WorkItem["proposal"]["fields"]> = [
        {},
        { conversation_id: "" },
        { conversation_id: 42 },
        { conversation_id: null },
    ]

    it("prefers the explicit conversation field over the legacy subject", () => {
        expect(
            answerConversationId(itemOf({ proposal: { summary: "Reply", fields: { conversation_id: "explicit" } } })),
        ).toBe("explicit")
    })

    it.each(legacyFields)("falls back to the legacy conversation subject for fields %j", (fields) => {
        expect(answerConversationId(itemOf({ proposal: { summary: "Reply", fields } }))).toBe("legacy-conversation")
    })

    it("returns null for an unrelated subject without an explicit address", () => {
        expect(answerConversationId(itemOf({ subject_type: "lead", subject_id: "lead-1" }))).toBeNull()
    })
})
