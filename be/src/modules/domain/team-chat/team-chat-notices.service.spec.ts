import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { ChatRoomEntity } from "./persistence/entities"
import { TeamChatNoticesService } from "./team-chat-notices.service"
import { TeamChatStoreService } from "./team-chat-store.service"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "22222222-2222-4222-8222-222222222222"
const ROOM = "33333333-3333-4333-8333-333333333333"
const NOW = "2026-11-11T10:00:00.000Z"
const EPISODE = new Date("2026-11-11T09:58:00.000Z")
const KEY = `bg-stopped:brain.policies.derive:${String(EPISODE.getTime())}`
const NIVO_KEY = `system:nivo|user:${OWNER}`

/** A stored direct room. */
const roomOf = (id: string): ChatRoomEntity => Object.assign(new ChatRoomEntity(), { id, kind: "direct", directKey: NIVO_KEY })

const build = async (owner: string | null = OWNER) => {
    const store = mock<TeamChatStoreService>()
    const workspaces = mock<WorkspacesService>()
    workspaces.ownerIdOf.mockResolvedValue(owner)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatNoticesService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { notices: moduleRef.get(TeamChatNoticesService), store, workspaces }
}

const REPORT = { work: "brain.policies.derive", reason: "model", episode: EPISODE } as const

/** The card the line carries, exactly as stored: codes only. */
const CARD = {
    kind: "background.stopped",
    intent: "notify",
    title: "brain.policies.derive",
    summary: "brain.policies.derive · model",
    payload: {
        version: 1,
        work: "brain.policies.derive",
        reason: "model",
        since: NOW,
        episode: EPISODE.toISOString(),
        target: { kind: "brain.policies" },
    },
    options: [],
}

describe("TeamChatNoticesService > postBackgroundStopped", () => {
    it("posts ONE system line with the typed card in the founder's NIVO room, keyed by the work and the episode", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValue("m-1")

        await expect(notices.postBackgroundStopped(WS, REPORT)).resolves.toBe("posted")

        expect(store.roomByDirectKey).toHaveBeenCalledWith(WS, NIVO_KEY)
        expect(store.insertRoom).not.toHaveBeenCalled()
        expect(store.insertLine).toHaveBeenCalledTimes(1)
        expect(store.insertLine).toHaveBeenCalledWith({
            workspaceId: WS,
            roomId: ROOM,
            authorAgentId: null,
            body: "brain.policies.derive · model",
            key: KEY,
            agentMessage: JSON.stringify(CARD),
        })
    })

    it("opens the NIVO room on the first write: direct, keyed system:nivo|user:<owner>, only the owner seated", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(null)
        store.insertRoom.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValue("m-1")

        await expect(notices.postBackgroundStopped(WS, REPORT)).resolves.toBe("posted")

        expect(store.insertRoom).toHaveBeenCalledWith({
            workspaceId: WS,
            createdBy: OWNER,
            kind: "direct",
            name: null,
            directKey: NIVO_KEY,
            others: [],
        })
        expect(store.insertLine).toHaveBeenCalledWith(expect.objectContaining({ roomId: ROOM }))
    })

})

describe("TeamChatNoticesService > postBackgroundStopped: one card per episode", () => {
    it("a retry of the same episode writes nothing new: the key exists, the answer is already", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValue(null)

        await expect(notices.postBackgroundStopped(WS, { ...REPORT, reason: "gave_up" })).resolves.toBe("already")
        expect(store.insertLine).toHaveBeenCalledWith(expect.objectContaining({ key: KEY }))
    })

    it("a new episode is a new key", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValue("m-2")
        const later = new Date("2026-11-11T11:00:00.000Z")

        await notices.postBackgroundStopped(WS, { ...REPORT, episode: later })

        expect(store.insertLine).toHaveBeenCalledWith(
            expect.objectContaining({ key: `bg-stopped:brain.policies.derive:${String(later.getTime())}` }),
        )
    })

    it("a workspace with no owner gets nothing: no room, no line", async () => {
        const { notices, store } = await build(null)

        await expect(notices.postBackgroundStopped(WS, REPORT)).resolves.toBe("no_owner")
        expect(store.roomByDirectKey).not.toHaveBeenCalled()
        expect(store.insertRoom).not.toHaveBeenCalled()
        expect(store.insertLine).not.toHaveBeenCalled()
    })
})

describe("TeamChatNoticesService > postNotice", () => {
    const NOTICE = { key: "usage-notice:warn:2026-10-01", body: "M\u1ee9c d\u00f9ng AI \u0111\u00e3 \u0111\u1ea1t 80%." }

    it("posts ONE plain system line (no card) in the founder's NIVO room, under the caller's key", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValue("m-1")

        await expect(notices.postNotice(WS, NOTICE)).resolves.toBe("posted")

        expect(store.roomByDirectKey).toHaveBeenCalledWith(WS, NIVO_KEY)
        expect(store.insertLine).toHaveBeenCalledTimes(1)
        expect(store.insertLine).toHaveBeenCalledWith({
            workspaceId: WS,
            roomId: ROOM,
            authorAgentId: null,
            body: NOTICE.body,
            key: NOTICE.key,
        })
    })

    it("opens the NIVO room on the first write", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(null)
        store.insertRoom.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValue("m-1")

        await expect(notices.postNotice(WS, NOTICE)).resolves.toBe("posted")

        expect(store.insertRoom).toHaveBeenCalledWith(expect.objectContaining({ directKey: NIVO_KEY, others: [] }))
    })

    it("dedupes: the same key a second time writes nothing new and answers already", async () => {
        const { notices, store } = await build()
        store.roomByDirectKey.mockResolvedValue(roomOf(ROOM))
        store.insertLine.mockResolvedValueOnce("m-1").mockResolvedValueOnce(null)

        await expect(notices.postNotice(WS, NOTICE)).resolves.toBe("posted")
        await expect(notices.postNotice(WS, NOTICE)).resolves.toBe("already")

        expect(store.insertLine.mock.calls.map(([line]) => line.key)).toEqual([NOTICE.key, NOTICE.key])
    })

    it("a workspace with no owner gets nothing", async () => {
        const { notices, store } = await build(null)

        await expect(notices.postNotice(WS, NOTICE)).resolves.toBe("no_owner")
        expect(store.insertLine).not.toHaveBeenCalled()
    })
})
