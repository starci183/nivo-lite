import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { WorkItem } from "@modules/domain/decisions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { replyBody, requireHandlingAccess, answerConversationId } from "./chatreply.policy"
import { ChatreplyError, ChatreplyErrorCode } from "./errors/chatreply.error"

const SUBJECT = Symbol("chatreply.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { replyBody, requireHandlingAccess, answerConversationId } }],
    }).compile()
    return moduleRef.get<typeof import("./chatreply.policy")>(SUBJECT)
}

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
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("replyBody", () => {
    it("trims the reply and preserves its interior whitespace", async () => {
        const subject = await build()

        expect(subject.replyBody(" \n Hello  customer \t")).toBe("Hello  customer")
    })

    it("accepts exactly 4000 characters after trimming", async () => {
        const subject = await build()

        const body = "x".repeat(4000)
        expect(subject.replyBody(` ${body} `)).toBe(body)
    })

    it.each([" \n\t", "x".repeat(4001)])("refuses an empty or oversized body", async (body) => {
        const subject = await build()

        expect(() => subject.replyBody(body)).toThrow(new ChatreplyError({ code: ChatreplyErrorCode.InvalidBody }))
    })
})

describe("requireHandlingAccess", () => {
    it.each([null, "OpenClaw", "An"])("permits staff when the conversation is held by %s", async (holder) => {
        const subject = await build()

        expect(subject.requireHandlingAccess(memberOf(), holder)).toBeUndefined()
    })

    it.each(["owner", "manager"] as const)("permits %s to reassign another holder", async (role) => {
        const subject = await build()

        expect(subject.requireHandlingAccess(memberOf({ role }), "Other")).toBeUndefined()
    })

    it("refuses staff trying to change another person's conversation", async () => {
        const subject = await build()

        expect(() => subject.requireHandlingAccess(memberOf(), "Other")).toThrow(
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

    it("prefers the explicit conversation field over the legacy subject", async () => {
        const subject = await build()

        expect(
            subject.answerConversationId(
                itemOf({ proposal: { summary: "Reply", fields: { conversation_id: "explicit" } } }),
            ),
        ).toBe("explicit")
    })

    it.each(legacyFields)("falls back to the legacy conversation subject for fields %j", async (fields) => {
        const subject = await build()

        expect(subject.answerConversationId(itemOf({ proposal: { summary: "Reply", fields } }))).toBe(
            "legacy-conversation",
        )
    })

    it("returns null for an unrelated subject without an explicit address", async () => {
        const subject = await build()

        expect(subject.answerConversationId(itemOf({ subject_type: "lead", subject_id: "lead-1" }))).toBeNull()
    })
})
