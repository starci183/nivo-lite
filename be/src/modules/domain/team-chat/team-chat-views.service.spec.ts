import { Test } from "@nestjs/testing"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { LessonCandidatesService } from "@modules/domain/brain-lessons"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatReactionStoreService } from "./team-chat-reaction-store.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const DECISION = "71111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-06T10:00:00.000Z")

const room = Object.assign(new ChatRoomEntity(), {
    id: ROOM,
    kind: "group",
    name: "Team",
    position: 0,
    createdBy: ANA,
    createdAt: AT,
})
const seat = (memberKind: "user" | "agent", memberId: string) =>
    Object.assign(new ChatRoomMemberEntity(), {
        roomId: ROOM,
        memberKind,
        memberId,
        role: "member",
        lastReadAt: AT,
        muted: false,
    })
const card = Object.assign(new ChatRoomMessageEntity(), {
    id: MSG,
    roomId: ROOM,
    authorKind: "agent",
    authorId: BOT,
    body: "Needs approval",
    kind: "approval",
    ref: { decision_id: DECISION },
    mentions: [{ kind: "user", id: ANA }],
    attachments: [{ fileKey: "k1", name: "a.pdf", mimeType: "application/pdf", sizeBytes: 3 }],
    createdAt: AT,
    editedAt: null,
})

const build = async () => {
    const store = mock<TeamChatStoreService>()
    const people = mock<WorkspaceMembersReadService>()
    const agents = mock<AgentDirectoryService>()
    const files = mock<TeamChatFilesService>()
    const approvals = mock<TeamChatApprovalsService>()
    const reactions = mock<TeamChatReactionStoreService>()
    store.messagesByIds.mockResolvedValue([])
    reactions.rowsAmong.mockResolvedValue([])
    people.namesOf.mockResolvedValue([{ userId: ANA, displayName: "Ana" }])
    agents.activeInOrder.mockResolvedValue([{ id: BOT, name: "Bot", module: "sales", canTagAgentIds: [] }])
    store.pinnedAmong.mockResolvedValue(new Set([MSG]))
    files.urlsOf.mockResolvedValue(new Map([["k1", "https://get/k1"]]))
    approvals.statesOf.mockResolvedValue(
        new Map([
            [
                DECISION,
                { decisionId: DECISION, status: "pending", decidedByName: null, decidedAt: null, canDecide: true },
            ],
        ]),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatViewsService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: WorkspaceMembersReadService, useValue: people },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: TeamChatFilesService, useValue: files },
            { provide: TeamChatApprovalsService, useValue: approvals },
            { provide: TeamChatReactionStoreService, useValue: reactions },
        ],
    }).compile()
    return { views: moduleRef.get(TeamChatViewsService), store, people, agents, files, approvals, reactions }
}

describe("TeamChatViewsService names and messages", () => {
    it("names each person and agent once, by kind and id", async () => {
        const { views, people, agents } = await build()
        const names = await views.namesOf(WS, [
            { memberKind: "user", memberId: ANA },
            { memberKind: "user", memberId: ANA },
            { memberKind: "agent", memberId: BOT },
        ])
        expect(names).toEqual(
            new Map([
                [`user:${ANA}`, "Ana"],
                [`agent:${BOT}`, "Bot"],
            ]),
        )
        expect(people.namesOf).toHaveBeenCalledWith(WS, [ANA])
        expect(agents.activeInOrder).toHaveBeenCalledWith(WS, [BOT], 1)
    })

    it("shows messages with the names, pins, file addresses and decision states of their cards", async () => {
        const { views, store, approvals } = await build()
        const [view] = await views.messageViews(WS, [card], ANA)
        expect(view).toMatchObject({
            id: MSG,
            authorName: "Bot",
            pinned: true,
            decisionId: DECISION,
            approval: { canDecide: true },
            mentions: [{ memberId: ANA, name: "Ana" }],
            attachments: [{ fileKey: "k1", url: "https://get/k1" }],
        })
        expect(store.pinnedAmong).toHaveBeenCalledWith([MSG])
        expect(approvals.statesOf).toHaveBeenCalledWith(WS, ANA, [DECISION])
    })

    it("shows nothing for no message, and one message on its own", async () => {
        const { views, store } = await build()
        await expect(views.messageViews(WS, [], ANA)).resolves.toEqual([])
        expect(store.pinnedAmong).not.toHaveBeenCalled()
        await expect(views.viewOf(WS, card, ANA)).resolves.toMatchObject({ id: MSG, body: "Needs approval" })
    })
})

describe("TeamChatViewsService rooms", () => {
    const readRooms = async () => {
        const built = await build()
        built.store.membersOf.mockResolvedValue([seat("user", ANA), seat("agent", BOT)])
        built.store.unreadRows.mockResolvedValue([{ roomId: ROOM, unreadCount: 2, mentionCount: 1 }])
        built.store.lastMessageIds.mockResolvedValue([MSG])
        built.store.messagesByIds.mockResolvedValue([card])
        return built
    }

    it("shows nothing for no room", async () => {
        const { views, store } = await build()
        await expect(views.roomViews(WS, ANA, [])).resolves.toEqual([])
        expect(store.membersOf).not.toHaveBeenCalled()
    })

    it("shows the rooms with their members, what the viewer has unread and the newest message", async () => {
        const { views, store } = await readRooms()
        const [view] = await views.roomViews(WS, ANA, [room])
        expect(view).toMatchObject({
            id: ROOM,
            name: "Team",
            unreadCount: 2,
            mentionCount: 1,
            lastMessage: { id: MSG },
            members: [{ name: "Ana" }, { name: "Bot" }],
        })
        expect(store.membersOf).toHaveBeenCalledWith([ROOM])
        expect(store.lastMessageIds).toHaveBeenCalledWith(WS, [ROOM])
        expect(store.unreadRows).toHaveBeenCalledWith(WS, ANA, null)
    })

    it("shows one room the same way", async () => {
        const { views } = await readRooms()
        await expect(views.roomView(WS, ANA, room)).resolves.toMatchObject({ id: ROOM, unreadCount: 2 })
    })
})

describe("TeamChatViewsService reactions and replies", () => {
    const QUOTED = "61111111-1111-4111-8111-111111111111"
    const THUMB = "\u{1F44D}"
    const text = (id: string, body: string, replyTo: string | null) =>
        Object.assign(new ChatRoomMessageEntity(), {
            id,
            roomId: ROOM,
            authorKind: "user",
            authorId: ANA,
            body,
            kind: "text",
            ref: null,
            mentions: [],
            attachments: [],
            createdAt: AT,
            editedAt: null,
            replyTo,
        })

    it("sums the reactions of each message for the viewer", async () => {
        const { views, reactions } = await build()
        reactions.rowsAmong.mockResolvedValue([
            { messageId: MSG, memberKind: "user", memberId: ANA, emoji: THUMB, count: 3 },
            { messageId: MSG, memberKind: "agent", memberId: BOT, emoji: THUMB, count: 2 },
        ])
        const [view] = await views.messageViews(WS, [text(MSG, "hi", null)], ANA)
        expect(view?.reactions).toEqual([{ emoji: THUMB, count: 5, mine: true, mineCount: 3 }])
        expect(reactions.rowsAmong).toHaveBeenCalledWith([MSG])
    })

    it("quotes the message a reply answers, with its author and its first words", async () => {
        const { views, store } = await build()
        store.messagesByIds.mockResolvedValue([text(QUOTED, "the   quoted\nwords", null)])
        const [view] = await views.messageViews(WS, [text(MSG, "yes", QUOTED)], ANA)
        expect(view?.replyTo).toEqual({ messageId: QUOTED, authorName: "Ana", body: "the quoted words" })
        expect(store.messagesByIds).toHaveBeenCalledWith(WS, [QUOTED])
    })

    it("shows no quote when the quoted message is gone", async () => {
        const { views } = await build()
        const [view] = await views.messageViews(WS, [text(MSG, "yes", QUOTED)], ANA)
        expect(view?.replyTo).toBeNull()
    })
})

describe("TeamChatViewsService stop cards", () => {
    const SEAT = "81111111-1111-4111-8111-111111111111"
    const stopLine = (replies: ReadonlyArray<{ readonly by: string }>) =>
        Object.assign(new ChatRoomMessageEntity(), {
            ...card,
            kind: "text",
            ref: {
                agent_message: JSON.stringify({
                    kind: "workflow.stopped",
                    title: "Quy trinh dang dung",
                    payload: {
                        workflow: { moduleKey: "sales", key: "consult", title: "Tu van ban hang" },
                        step: { key: "consult", nodeId: "sales.consult", title: "Tu van" },
                        runId: "run-1",
                        leadId: null,
                        conversationId: null,
                        by: "ai",
                        reason: "Khach hoi gia si.",
                        question: "Bao gia nao?",
                        facts: [],
                        suggestions: [],
                        decisions: [],
                        repeats: 1,
                        firstAt: "2026-11-10T10:00:00.000Z",
                        lastAt: "2026-11-10T10:00:00.000Z",
                        stop: {
                            version: 1,
                            stopId: "stop-1",
                            runId: "run-1",
                            stepKey: "consult",
                            kind: "ai_report",
                            state: "answered",
                            headline: "Da nhan tra loi",
                            needs: { answer: false, decisions: [], verdicts: [] },
                            replies: replies.map((reply) => ({
                                kind: "answer",
                                text: "Gia si 10%",
                                by: reply.by,
                                at: "2026-11-10T10:05:00.000Z",
                            })),
                            repeats: 1,
                            stoppedAt: "2026-11-10T10:00:00.000Z",
                            resolvedAt: null,
                            revision: 2,
                        },
                    },
                }),
            },
        })

    it("names the founder who replied to a stop card by the seat the stop keeps", async () => {
        const { views, people } = await build()
        people.directory.mockResolvedValue([
            { id: SEAT, user_id: ANA, display_name: "Ana", role: "owner", status: "active" },
            { id: "other", user_id: "u2", display_name: "Ben", role: "manager", status: "active" },
        ])

        const [view] = await views.messageViews(WS, [stopLine([{ by: SEAT }])], ANA)

        expect(view?.stop?.replies).toEqual([
            { kind: "answer", text: "Gia si 10%", by: SEAT, at: "2026-11-10T10:05:00.000Z", byName: "Ana" },
        ])
    })

    it("reads no directory when no card on the page has a reply", async () => {
        const { views, people } = await build()
        const [view] = await views.messageViews(WS, [stopLine([])], ANA)
        expect(view?.stop?.state).toBe("answered")
        expect(people.directory).not.toHaveBeenCalled()
    })
})

describe("TeamChatViewsService brain.change cards", () => {
    const plainLine = () =>
        Object.assign(new ChatRoomMessageEntity(), {
            ...card,
            kind: "text",
            ref: null,
            body: "hi",
            attachments: [],
            mentions: [],
        })
    const brainLine = () =>
        Object.assign(new ChatRoomMessageEntity(), {
            ...card,
            kind: "text",
            attachments: [],
            ref: {
                agent_message: JSON.stringify({
                    kind: "brain.change",
                    title: "t",
                    payload: {
                        version: 1,
                        changeId: "p-ship",
                        origin: "chat",
                        kind: "change",
                        factKey: { subjectLabel: "Giao hang", attributeLabel: "Phi ship" },
                        oldValue: null,
                        current: null,
                        newValue: "30.000 d",
                        unit: null,
                        validFrom: null,
                        validTo: null,
                        reason: "Anh vua nhan phi ship 30k.",
                        evidence: [
                            {
                                kind: "message",
                                quote: "phi ship 30k",
                                ref: "team-chat:m-1",
                                by: { name: "Ana", memberId: null },
                                at: null,
                            },
                        ],
                        state: "open",
                        decidedBy: null,
                        supersededBy: null,
                        revision: 1,
                    },
                }),
            },
        })

    it("reads the viewer's role only when the page holds a brain.change card, and offers what the role may do", async () => {
        const { views, people } = await build()
        people.directory.mockResolvedValue([
            { id: "seat-ana", user_id: ANA, display_name: "Ana", role: "manager", status: "active" },
        ])

        const [plain] = await views.messageViews(WS, [plainLine()], ANA)
        expect(plain?.brainChange).toBeNull()
        expect(people.directory).not.toHaveBeenCalled()

        const [view] = await views.messageViews(WS, [brainLine()], ANA)
        expect(people.directory).toHaveBeenCalledTimes(1)
        expect(view?.brainChange).toMatchObject({ changeId: "p-ship", canApprove: false, canReject: true })
    })

    it("offers nothing to a viewer the directory does not list as owner or manager", async () => {
        const { views, people } = await build()
        people.directory.mockResolvedValue([])
        const [view] = await views.messageViews(WS, [brainLine()], ANA)
        expect(view?.brainChange).toMatchObject({ canApprove: false, canReject: false })
    })

    it("U1: shows a manager what a LEARNING card's proposal cost (its lessons' calls), and staff nothing; reads none for staff", async () => {
        const lessons = mock<LessonCandidatesService>()
        lessons.ofChange.mockResolvedValue([{ id: "c1" }, { id: "c2" }] as never)
        const usage = mock<AiUsageOverviewService>()
        usage.lessonsCostOf.mockResolvedValue({
            calls: 2,
            failedTries: 0,
            tokens: 900,
            costUsd: 0.000339,
            credits: 0.3,
            failedCostUsd: 0,
            failedCredits: 0,
        })
        const { people, ...deps } = await build()
        const views = new TeamChatViewsService(
            deps.store,
            people,
            deps.agents,
            deps.files,
            deps.approvals,
            deps.reactions,
            lessons,
            usage,
        )
        const learned = brainLine()
        learned.ref = {
            agent_message: (learned.ref?.agent_message ?? "").replace('"origin":"chat"', '"origin":"learning"'),
        }

        people.directory.mockResolvedValue([
            { id: "seat-ana", user_id: ANA, display_name: "Ana", role: "manager", status: "active" },
        ])
        const [seen] = await views.messageViews(WS, [learned], ANA)
        expect(seen?.brainChange?.cost).toEqual({ credits: 0.3, usd: 0.000339 })
        expect(lessons.ofChange).toHaveBeenCalledWith(WS, "p-ship")
        expect(usage.lessonsCostOf).toHaveBeenCalledWith(WS, ["c1", "c2"])

        lessons.ofChange.mockClear()
        people.directory.mockResolvedValue([
            { id: "seat-ana", user_id: ANA, display_name: "Ana", role: "staff", status: "active" },
        ])
        const [staff] = await views.messageViews(WS, [learned], ANA)
        expect(staff?.brainChange?.cost).toBeNull()
        expect(lessons.ofChange).not.toHaveBeenCalled()
    })
})
