import "reflect-metadata"
import { builder } from "@starci/jest-preset"
import type { ApprovalView, CandidateView, MessagePage } from "@modules/domain/office-command-candidates"
import { ListThreadMessagesRequest } from "./dto/list-thread-messages.request"
import {
    toApprovalsResponse,
    toCandidateResponse,
    toCandidatesResponse,
    toConfirmResultResponse,
    toMessagePageResponse,
    toProposeOutcomeResponse,
    toThreadQueryRequest,
} from "./office.mapper"

const candidate = builder<CandidateView>({
    id: "c-1",
    message_id: "m-1",
    module: "sales",
    command: "follow_up",
    payload: { lead_id: "l-1" },
    summary: "Follow up",
    shown: [{ key: "lead", label: "Customer", value: "An" }],
    status: "pending",
    work_item_id: null,
    refusal_detail: null,
    created_at: "2026-10-12T10:00:00.000Z",
})

describe("office mapper", () => {
    it("takes the first page when the request names no cursor", () => {
        const input = new ListThreadMessagesRequest()

        expect(toThreadQueryRequest("ws-1", input)).toEqual({ workspaceId: "ws-1", before: null, limit: 50 })
    })

    it("carries the cursor of the request", () => {
        const input = new ListThreadMessagesRequest()
        input.before = { createdAt: "2026-10-12T10:00:00.000Z", id: "m-9" }
        input.limit = 20

        expect(toThreadQueryRequest("ws-1", input)).toEqual({
            workspaceId: "ws-1",
            before: { createdAt: "2026-10-12T10:00:00.000Z", id: "m-9" },
            limit: 20,
        })
    })

    it("copies a card with its shown rows", () => {
        expect(toCandidateResponse(candidate())).toEqual(candidate())
        expect(toCandidatesResponse([candidate()])).toEqual([candidate()])
    })

    it("maps the three proposal outcomes", () => {
        expect(toProposeOutcomeResponse({ kind: "chat" })).toEqual({ kind: "chat" })
        expect(toProposeOutcomeResponse({ kind: "reply", body: "ok" })).toEqual({ kind: "reply", body: "ok" })
        expect(toProposeOutcomeResponse({ kind: "card", candidate: candidate() })).toEqual({
            kind: "card",
            candidate: candidate(),
        })
    })

    it("copies a confirm result", () => {
        expect(toConfirmResultResponse({ workItemId: "w-1", module: "sales", created: true })).toEqual({
            workItemId: "w-1",
            module: "sales",
            created: true,
        })
    })

    it("maps a page with and without a next cursor", () => {
        const message = {
            id: "m-1",
            author_kind: "human" as const,
            author_name: "Chu",
            agent_id: null,
            staff_id: null,
            body: "hi",
            lead_id: null,
            work_item_id: null,
            created_at: "2026-10-12T10:00:00.000Z",
        }
        const last: MessagePage = { messages: [message], next: null }
        const more: MessagePage = { messages: [message], next: { createdAt: message.created_at, id: "m-1" } }

        expect(toMessagePageResponse(last)).toEqual({ messages: [message], next: null })
        expect(toMessagePageResponse(more).next).toEqual({ createdAt: message.created_at, id: "m-1" })
    })

    it("copies approval cards", () => {
        const approval = builder<ApprovalView>({
            id: "a-1",
            responsibility_id: "r-1",
            agent_id: null,
            kind: "follow_up",
            draft: "Hello",
            status: "pending_approval",
            decided_by: null,
            decided_at: null,
            created_at: "2026-10-12T10:00:00.000Z",
            work_item_id: null,
            leadName: null,
            leadId: null,
            channel: "",
            agentName: null,
            nextAction: "",
            assignedStaffId: null,
        })

        expect(toApprovalsResponse([approval()])).toEqual([approval()])
    })
})
