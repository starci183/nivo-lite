import { Test } from "@nestjs/testing"
import { messageOf, roomOf, seatOf } from "@tests/fixtures/builders/team-chat.builder"
import {
    compareRooms,
    memberViewsOf,
    messageViewOf,
    nameKeyOf,
    refsOfMessages,
    roomViewOf,
    stopReplierIdsOf,
    brainChangeViewerRoleOf,
    holdsBrainChange,
} from "./team-chat-view.policy"
import type { MessageViewContext } from "./team-chat-view.policy"
import type { ChatRoomView } from "./team-chat.contracts"

const SUBJECT = Symbol("team-chat-view.policy")

const ANA = "22222222-1111-4111-8111-111111111111"
const BEN = "23333333-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const RUN = "61111111-1111-4111-8111-111111111111"
const DECISION = "71111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-06T10:00:00.000Z")
const LATER = new Date("2026-11-06T11:00:00.000Z")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    compareRooms,
                    memberViewsOf,
                    messageViewOf,
                    nameKeyOf,
                    refsOfMessages,
                    roomViewOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        compareRooms: typeof compareRooms
        memberViewsOf: typeof memberViewsOf
        messageViewOf: typeof messageViewOf
        nameKeyOf: typeof nameKeyOf
        refsOfMessages: typeof refsOfMessages
        roomViewOf: typeof roomViewOf
    }>(SUBJECT)
}

const CONTEXT: MessageViewContext = {
    names: new Map([
        [`user:${ANA}`, "Ana"],
        [`user:${BEN}`, "Ben"],
        [`agent:${BOT}`, "Bot"],
    ]),
    pinned: new Set([MSG]),
    urls: new Map([["k1", "https://get/k1"]]),
    approvals: new Map([
        [DECISION, { decisionId: DECISION, status: "pending", decidedByName: null, decidedAt: null, canDecide: true }],
    ]),
    reactions: new Map(),
    quoted: new Map(),
}

describe("message views", () => {
    it("names the authors and the mentioned members, and skips a system line", async () => {
        const subject = await buildSubject()
        const refs = subject.refsOfMessages([
            messageOf({ mentions: [{ kind: "agent", id: BOT }] }),
            messageOf({ authorKind: "system", authorId: null }),
            messageOf({ authorKind: "system", authorId: ANA }),
        ])
        expect(refs).toEqual([
            { memberKind: "user", memberId: ANA },
            { memberKind: "agent", memberId: BOT },
        ])
        expect(subject.nameKeyOf("agent", BOT)).toBe(`agent:${BOT}`)
    })

    it("shows a text with its author, pin, mentions and files", async () => {
        const subject = await buildSubject()
        const view = subject.messageViewOf(
            messageOf({
                mentions: [{ kind: "agent", id: BOT }],
                attachments: [{ fileKey: "k1", name: "plan.pdf", mimeType: "application/pdf", sizeBytes: 9 }],
            }),
            CONTEXT,
        )
        expect(view).toEqual({
            id: MSG,
            roomId: ROOM,
            kind: "text",
            authorKind: "user",
            authorId: ANA,
            authorName: "Ana",
            body: "hello",
            createdAt: AT,
            editedAt: null,
            pinned: true,
            mentions: [{ memberKind: "agent", memberId: BOT, name: "Bot" }],
            attachments: [
                { fileKey: "k1", name: "plan.pdf", mimeType: "application/pdf", sizeBytes: 9, url: "https://get/k1" },
            ],
            runId: null,
            decisionId: null,
            approval: null,
            agentMessage: null,
            reactions: [],
            replyTo: null,
            forwardedFrom: null,
            stop: null,
            brainChange: null,
            backgroundStopped: null,
        })
    })
})

describe("message views of cards and of unknown context", () => {
    it("shows a report with its run and an approval card with its decision and state", async () => {
        const subject = await buildSubject()
        expect(subject.messageViewOf(messageOf({ kind: "report", ref: { run_id: RUN } }), CONTEXT)).toMatchObject({
            runId: RUN,
            decisionId: null,
        })
        expect(
            subject.messageViewOf(messageOf({ kind: "approval", ref: { decision_id: DECISION } }), CONTEXT),
        ).toMatchObject({ runId: null, decisionId: DECISION, approval: { canDecide: true } })
        expect(subject.messageViewOf(messageOf({ kind: "report", ref: {} }), CONTEXT).runId).toBeNull()
    })

    it("carries the structured message of an agent line beside its words, and none for a plain line", async () => {
        const subject = await buildSubject()
        const json = JSON.stringify({ kind: "order.summary", intent: "notify" })
        expect(subject.messageViewOf(messageOf({ ref: { agent_message: json } }), CONTEXT).agentMessage).toBe(json)
        expect(subject.messageViewOf(messageOf({ ref: null }), CONTEXT).agentMessage).toBeNull()
    })

    it("shows empty names and addresses for what the context does not know, and no author for a system line", async () => {
        const subject = await buildSubject()
        const view = subject.messageViewOf(
            messageOf({
                id: "other",
                authorKind: "system",
                authorId: null,
                kind: "approval",
                ref: { decision_id: "unknown" },
                mentions: [{ kind: "user", id: "ghost" }],
                attachments: [{ fileKey: "k9", name: "x", mimeType: "text/plain", sizeBytes: 1 }],
            }),
            CONTEXT,
        )
        expect(view).toMatchObject({
            authorName: "",
            pinned: false,
            mentions: [{ name: "" }],
            attachments: [{ url: "" }],
            approval: null,
        })
        expect(subject.messageViewOf(messageOf({ authorId: "ghost" }), CONTEXT).authorName).toBe("")
    })
})

describe("room views", () => {
    const members = [seatOf("user", BEN, "member", true), seatOf("user", ANA, "owner"), seatOf("agent", BOT)]
    const context = {
        viewerId: ANA,
        names: CONTEXT.names,
        unread: new Map([[ROOM, { roomId: ROOM, unreadCount: 2, mentionCount: 1 }]]),
        lasts: new Map([[ROOM, messageViewOf(messageOf(), CONTEXT)]]),
    }

    it("lists owners first and then by name", async () => {
        const subject = await buildSubject()
        expect(subject.memberViewsOf(members, CONTEXT.names).map((view) => view.name)).toEqual(["Ana", "Ben", "Bot"])
        expect(subject.memberViewsOf([seatOf("user", "ghost")], CONTEXT.names)[0]?.name).toBe("")
    })

    it("shows a group with its name, counts, the mute of the viewer and the newest message", async () => {
        const subject = await buildSubject()
        const view = subject.roomViewOf(roomOf(), members, { ...context, viewerId: BEN })
        expect(view).toMatchObject({
            id: ROOM,
            kind: "group",
            purpose: "group",
            purposeModule: null,
            name: "Team",
            position: 4,
            createdBy: ANA,
            unreadCount: 2,
            mentionCount: 1,
            muted: true,
            lastMessage: { id: MSG },
        })
        expect(view.members).toHaveLength(3)
    })

    it("names a direct room after the other member, and shows zeroes for a room nothing is known of", async () => {
        const subject = await buildSubject()
        const direct = subject.roomViewOf(roomOf({ kind: "direct", name: null }), members.slice(1), {
            ...context,
            unread: new Map(),
            lasts: new Map(),
        })
        expect(direct).toMatchObject({ name: "Bot", unreadCount: 0, mentionCount: 0, muted: false, lastMessage: null })
        expect(subject.roomViewOf(roomOf({ name: null }), [], context).name).toBe("")
        expect(subject.roomViewOf(roomOf({ kind: "direct", name: null }), [], context).name).toBe("")
    })

    it("sorts the room with the newest message first and the rooms with none by position", async () => {
        const subject = await buildSubject()
        const view = (position: number, at: Date | null): ChatRoomView => ({
            ...subject.roomViewOf(roomOf({ position }), [], context),
            lastMessage: at === null ? null : messageViewOf(messageOf({ createdAt: at }), CONTEXT),
        })
        const sorted = [view(2, null), view(9, AT), view(1, null), view(5, LATER)].toSorted(subject.compareRooms)
        expect(sorted.map((room) => room.position)).toEqual([5, 9, 1, 2])
    })
})

describe("message views of a stop card", () => {
    const CARD = {
        workflow: { moduleKey: "accounting", key: "reconcile", title: "Doi soat tien ve" },
        step: { key: "match", nodeId: "accounting.match-payment", title: "Khop giao dich" },
        runId: RUN,
        leadId: null,
        conversationId: null,
        by: "ai",
        reason: "Con thieu 500 VND.",
        question: "Giu don mo?",
        facts: [],
        suggestions: [],
        decisions: [],
        repeats: 1,
        firstAt: "2026-11-10T10:00:00.000Z",
        lastAt: "2026-11-10T10:00:00.000Z",
        stop: {
            version: 1,
            stopId: "stop-1",
            runId: RUN,
            stepKey: "match",
            kind: "ai_report",
            state: "answered",
            headline: "Da nhan tra loi",
            needs: { answer: false, decisions: [], verdicts: [] },
            replies: [
                { kind: "answer", text: "Giu don mo nhe", by: "seat-ana", at: "2026-11-10T10:05:00.000Z" },
                { kind: "timeout", text: null, by: "deadline", at: "2026-11-11T10:05:00.000Z" },
            ],
            repeats: 1,
            stoppedAt: "2026-11-10T10:00:00.000Z",
            resolvedAt: null,
            revision: 2,
        },
    }
    const line = messageOf({
        authorKind: "agent",
        authorId: BOT,
        ref: { agent_message: JSON.stringify({ kind: "workflow.stopped", title: "Da nhan tra loi", payload: CARD }) },
    })

    it("reads the repliers of the stop cards, a deadline being no person", () => {
        expect(stopReplierIdsOf([line, messageOf()])).toEqual(["seat-ana"])
    })

    it("shows the typed stop with the name of each replier, and none for a plain line", async () => {
        const subject = await buildSubject()
        const view = subject.messageViewOf(line, { ...CONTEXT, stopNames: new Map([["seat-ana", "Ana"]]) })
        expect(view.stop).toMatchObject({
            stopId: "stop-1",
            state: "answered",
            workflowTitle: "Doi soat tien ve",
            stepTitle: "Khop giao dich",
            message: "Con thieu 500 VND.",
            replies: [
                { kind: "answer", text: "Giu don mo nhe", byName: "Ana" },
                { kind: "timeout", byName: "" },
            ],
            revision: 2,
        })
        expect(subject.messageViewOf(line, CONTEXT).stop?.replies[0]?.byName).toBe("")
        expect(subject.messageViewOf(messageOf(), CONTEXT).stop).toBeNull()
    })
})

describe("message views of a brain.change card", () => {
    const PAYLOAD = {
        version: 1,
        changeId: "p-ship",
        origin: "chat",
        kind: "change",
        factKey: { subjectLabel: "Giao hang", attributeLabel: "Phi ship noi thanh" },
        oldValue: "20.000 d",
        current: { value: "20.000 d", version: 2, source: "Quy dinh giao hang.docx" },
        newValue: "30.000 d",
        unit: null,
        validFrom: null,
        validTo: null,
        reason: "Anh vua nhan tu mai phi ship noi thanh la 30k.",
        evidence: [
            {
                kind: "message",
                quote: "tu mai 30k",
                ref: "team-chat:m-1",
                by: { name: "Ana", memberId: ANA },
                at: null,
            },
        ],
        state: "open",
        decidedBy: null,
        supersededBy: null,
        revision: 1,
    }
    const card = (payload: Readonly<Record<string, unknown>>) =>
        messageOf({ ref: { agent_message: JSON.stringify({ kind: "brain.change", title: "t", payload }) } })

    it("offers approve to the owner alone and reject to the owner and a manager while open; a plain line has none", async () => {
        const subject = await buildSubject()
        const line = card(PAYLOAD)
        expect(subject.messageViewOf(line, { ...CONTEXT, viewerRole: "owner" }).brainChange).toMatchObject({
            changeId: "p-ship",
            canApprove: true,
            canReject: true,
        })
        expect(subject.messageViewOf(line, { ...CONTEXT, viewerRole: "manager" }).brainChange).toMatchObject({
            canApprove: false,
            canReject: true,
        })
        expect(subject.messageViewOf(line, CONTEXT).brainChange).toMatchObject({ canApprove: false, canReject: false })
        expect(subject.messageViewOf(line, CONTEXT).brainChange).not.toHaveProperty("version")
        expect(subject.messageViewOf(messageOf(), CONTEXT).brainChange).toBeNull()
    })

    it("offers nothing once the card is decided", async () => {
        const subject = await buildSubject()
        const decided = card({
            ...PAYLOAD,
            state: "applied",
            decidedBy: { memberId: ANA, name: "Ana", at: "2026-11-11T00:00:00.000Z" },
        })
        expect(subject.messageViewOf(decided, { ...CONTEXT, viewerRole: "owner" }).brainChange).toMatchObject({
            state: "applied",
            canApprove: false,
            canReject: false,
        })
    })

    it("reads the viewer's role only for a page that holds such a card, and maps any other role to member", () => {
        expect(holdsBrainChange([messageOf(), card(PAYLOAD)])).toBe(true)
        expect(holdsBrainChange([messageOf()])).toBe(false)
        expect(brainChangeViewerRoleOf("owner")).toBe("owner")
        expect(brainChangeViewerRoleOf("manager")).toBe("manager")
        expect(brainChangeViewerRoleOf("staff")).toBe("member")
        expect(brainChangeViewerRoleOf(null)).toBe("member")
    })
})

describe("the NIVO room and NIVO's background.stopped card", () => {
    const nivoRoom = roomOf({ kind: "direct", name: null, directKey: `system:nivo|user:${ANA}` })
    const context = { viewerId: ANA, names: CONTEXT.names, unread: new Map(), lasts: new Map() }

    it("a NIVO room (only the founder seated) is named NIVO and flagged withNivo; any other room is not", async () => {
        const subject = await buildSubject()
        expect(subject.roomViewOf(nivoRoom, [seatOf("user", ANA, "owner")], context)).toMatchObject({
            kind: "direct",
            name: "NIVO",
            withNivo: true,
        })
        const pair = roomOf({ kind: "direct", name: null, directKey: `agent:${BOT}|user:${ANA}` })
        expect(subject.roomViewOf(pair, [seatOf("user", ANA, "owner"), seatOf("agent", BOT)], context)).toMatchObject({
            name: "Bot",
            withNivo: false,
        })
        expect(subject.roomViewOf(roomOf(), [], context).withNivo).toBe(false)
    })

    it("reads the typed card of a system line, and none for a line of another kind", async () => {
        const subject = await buildSubject()
        const payload = {
            version: 1,
            work: "brain.policies.derive",
            reason: "gave_up",
            since: "2026-11-11T10:00:00.000Z",
            episode: "2026-11-11T09:58:00.000Z",
            target: { kind: "brain.policies" },
        }
        const line = messageOf({
            authorKind: "system",
            authorId: null,
            kind: "system",
            ref: { agent_message: JSON.stringify({ kind: "background.stopped", payload }) },
        })
        const view = subject.messageViewOf(line, CONTEXT)
        expect(view.backgroundStopped).toEqual({
            work: "brain.policies.derive",
            reason: "gave_up",
            since: "2026-11-11T10:00:00.000Z",
            episode: "2026-11-11T09:58:00.000Z",
            target: { kind: "brain.policies" },
        })
        expect(view).toMatchObject({ authorKind: "system", authorName: "", stop: null, brainChange: null })
        expect(subject.messageViewOf(messageOf(), CONTEXT).backgroundStopped).toBeNull()
    })
})

describe("who may write in a room (mayPost)", () => {
    const context = {
        viewerId: ANA,
        names: CONTEXT.names,
        unread: new Map([[ROOM, { roomId: ROOM, unreadCount: 2, mentionCount: 1 }]]),
        lasts: new Map([[ROOM, messageViewOf(messageOf(), CONTEXT)]]),
    }

    it("shows whether each seat may write: an agent by the right it holds, a person in every room but a read-only one", async () => {
        const subject = await buildSubject()
        const seats = [
            { ...seatOf("agent", BOT), mayPost: true },
            { ...seatOf("user", BEN), mayPost: false },
            seatOf("user", ANA),
        ]
        const byName = new Map(subject.memberViewsOf(seats, CONTEXT.names).map((view) => [view.name, view.mayPost]))
        expect(byName.get("Bot")).toBe(true)
        // A person's seat never carries the agents' post right: it may write wherever it sits.
        expect(byName.get("Ben")).toBe(true)
        expect(byName.get("Ana")).toBe(true)
        expect(subject.memberViewsOf([seatOf("agent", BOT)], CONTEXT.names)[0]?.mayPost).toBe(false)
        const readOnly = new Map(
            subject.memberViewsOf(seats, CONTEXT.names, true).map((view) => [view.name, view.mayPost]),
        )
        expect(readOnly.get("Ana")).toBe(false)
        expect(readOnly.get("Bot")).toBe(true)
    })

    it("the founder's NIVO room answers mayPost false for the founder's seat; any other direct room answers true", async () => {
        const subject = await buildSubject()
        const nivo = roomOf({ kind: "direct", name: null, directKey: `system:nivo|user:${ANA}`, purpose: "direct" })
        const view = subject.roomViewOf(nivo, [seatOf("user", ANA)], { ...context, viewerId: ANA })
        expect(view.withNivo).toBe(true)
        expect(view.members.map((member) => [member.memberId, member.mayPost])).toEqual([[ANA, false]])

        const pair = roomOf({ kind: "direct", name: null, directKey: `user:${ANA}|user:${BEN}`, purpose: "direct" })
        const open = subject.roomViewOf(pair, [seatOf("user", ANA), seatOf("user", BEN)], { ...context, viewerId: ANA })
        expect(open.withNivo).toBe(false)
        expect(open.members.every((member) => member.mayPost)).toBe(true)
    })
})
