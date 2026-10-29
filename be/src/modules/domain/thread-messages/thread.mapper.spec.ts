import { Test } from "@nestjs/testing"
import type { WorkThread } from "@modules/domain/work-threads"
import type { ThreadDigestRecord, ThreadMessageRecord } from "./thread-messages.contracts"
import { toListing, toMessage } from "./thread.mapper"

const SUBJECT = Symbol("thread.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toListing, toMessage } }],
    }).compile()
    return moduleRef.get<typeof import("./thread.mapper")>(SUBJECT)
}

const thread: WorkThread = {
    id: "thread-1",
    workspaceId: "ws-1",
    title: "Villa booking for Ms Thao",
    leadId: "lead-1",
    orderId: null,
    status: "waiting",
    createdBy: "van",
    createdAt: "2026-10-22T02:41:00.000Z",
    updatedAt: "2026-10-22T02:45:00.000Z",
}

const digest: ThreadDigestRecord = {
    thread_id: "thread-1",
    last_body: "Confirmation sent.",
    last_at: new Date("2026-10-22T09:45:00+07:00"),
    message_count: 7,
    waiting_approval: true,
}

const messageRow = (overrides: Partial<ThreadMessageRecord> = {}): ThreadMessageRecord => ({
    id: "msg-1",
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "agent",
    author_id: "agent-1",
    author_name: "AI Sales",
    author_role: "sales",
    body: "Ms Thao booked 2 villa nights.",
    quoted: [],
    mentions: [{ kind: "member", id: "minh", name: "Mr Minh" }],
    approval: null,
    created_at: new Date("2026-10-22T09:41:00+07:00"),
    ...overrides,
})

describe("thread mapper", () => {
    it("adds the newest line, the count and the pending flag of a digest to a thread", async () => {
        const subject = await buildSubject()

        expect(subject.toListing(thread, digest)).toEqual({
            ...thread,
            lastBody: "Confirmation sent.",
            lastAt: "2026-10-22T02:45:00.000Z",
            messageCount: 7,
            waitingApproval: true,
        })
    })

    it("lists a thread with no message as empty", async () => {
        const subject = await buildSubject()

        expect(subject.toListing(thread, undefined)).toEqual({
            ...thread,
            lastBody: null,
            lastAt: null,
            messageCount: 0,
            waitingApproval: false,
        })
    })

    it("does not flag a digest with no pending approval", async () => {
        const subject = await buildSubject()

        expect(subject.toListing(thread, { ...digest, waiting_approval: false }).waitingApproval).toBe(false)
    })

    it("reads an agent message with its tags", async () => {
        const subject = await buildSubject()

        expect(subject.toMessage(messageRow())).toEqual({
            id: "msg-1",
            threadId: "thread-1",
            authorKind: "agent",
            authorId: "agent-1",
            authorName: "AI Sales",
            authorRole: "sales",
            body: "Ms Thao booked 2 villa nights.",
            quoted: [],
            mentions: [{ kind: "member", id: "minh", name: "Mr Minh" }],
            approval: null,
            createdAt: "2026-10-22T02:41:00.000Z",
        })
    })

    it("reads a member message", async () => {
        const subject = await buildSubject()

        expect(subject.toMessage(messageRow({ author_kind: "member", author_id: "minh" }))).toMatchObject({
            authorKind: "member",
            authorId: "minh",
        })
    })
})
