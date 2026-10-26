import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { AFTER_COMMIT, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { AfterCommit } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { ChatActivityLogEvent } from "./chat-activity.log-events"
import { ChatActivityService } from "./chat-activity.service"
import { chatActivityTopic } from "./chat-activity.policy"
import type { ActiveMemberRow } from "./persistence/chat-activity.rows"
import { LIST_ACTIVE_MEMBER_IDS } from "./persistence/chat-activity.sql"

const NOW = "2026-10-26T01:00:00.000Z"
const WS = "WS-1"
const MEMBERS: ReadonlyArray<ActiveMemberRow> = [{ user_id: "author" }, { user_id: "bob" }, { user_id: "cara" }]
const inside = mockEntityManager()

const build = async (members: ReadonlyArray<ActiveMemberRow> = MEMBERS) => {
    const entityManager = mockEntityManager({ query: [LIST_ACTIVE_MEMBER_IDS, members] })
    const hub = mock<RealtimeHub>({ publish: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const commits = mock<AfterCommit>({
        run: jest.fn((_manager: unknown, task: () => Promise<void>) => task()),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatActivityService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: REALTIME_HUB, useValue: hub },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: LOGGER, useValue: logger },
            { provide: AFTER_COMMIT, useValue: commits },
        ],
    }).compile()
    return { service: moduleRef.get(ChatActivityService), entityManager, hub, logger, commits }
}

const fieldOf = (frame: object, key: string): string => {
    const value: unknown = Object.entries(frame).find(([name]) => name === key)?.[1]
    return typeof value === "string" ? value : ""
}

/** The recipient, kind, target and time of every published frame, in publishing order. */
const published = (hub: Pick<jest.Mocked<RealtimeHub>, "publish">) =>
    hub.publish.mock.calls.map(([topic, frame]) => ({
        topic: topic.name,
        kind: fieldOf(frame, "kind"),
        target: fieldOf(frame, "roomOrConversation"),
        at: fieldOf(frame, "at"),
    }))

describe("ChatActivityService.message", () => {
    it("tells every active member of the line and every member but its author of the unread", async () => {
        const { service, entityManager, hub } = await build()

        await service.message(WS, "room:sales", "author", inside)

        expect(entityManager.query.mock.calls).toEqual([[LIST_ACTIVE_MEMBER_IDS, [WS]]])
        expect(published(hub)).toEqual([
            { topic: chatActivityTopic("author", WS).name, kind: "message", target: "room:sales", at: NOW },
            { topic: chatActivityTopic("bob", WS).name, kind: "message", target: "room:sales", at: NOW },
            { topic: chatActivityTopic("cara", WS).name, kind: "message", target: "room:sales", at: NOW },
            { topic: chatActivityTopic("bob", WS).name, kind: "unread", target: "room:sales", at: NOW },
            { topic: chatActivityTopic("cara", WS).name, kind: "unread", target: "room:sales", at: NOW },
        ])
    })

    it("gives every frame its own id prefixed by its kind", async () => {
        const { service, hub } = await build()

        await service.message(WS, "room:office", null)

        const ids = hub.publish.mock.calls.map(([, frame]) => fieldOf(frame, "id"))
        expect(new Set(ids).size).toBe(6)
        expect(ids.slice(0, 3).every((id) => id.startsWith("message:"))).toBe(true)
        expect(ids.slice(3).every((id) => id.startsWith("unread:"))).toBe(true)
    })

    it("counts the line unread for everyone when no member wrote it", async () => {
        const { service, hub } = await build()

        await service.message(WS, "room:office", null)

        expect(published(hub).filter((frame) => frame.kind === "unread")).toHaveLength(3)
    })

    it("pushes nothing when the workspace has no active member", async () => {
        const { service, hub } = await build([])

        await service.message(WS, "room:sales", "author")

        expect(hub.publish).not.toHaveBeenCalled()
    })

    it("logs a failed push and still settles, because the line is already stored", async () => {
        const { service, hub, logger } = await build()
        const cause = new Error("hub down")
        hub.publish.mockRejectedValue(cause)

        await expect(service.message(WS, "room:sales", "author")).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(ChatActivityLogEvent.PublishFailed, cause, { workspaceId: WS })
    })

    it("logs a failed member lookup and still settles", async () => {
        const { service, entityManager, hub, logger } = await build()
        const cause = new Error("db down")
        entityManager.query.mockRejectedValue(cause)

        await expect(service.message(WS, "room:sales", "author")).resolves.toBeUndefined()

        expect(hub.publish).not.toHaveBeenCalled()
        expect(logger.error).toHaveBeenCalledWith(ChatActivityLogEvent.PublishFailed, cause, { workspaceId: WS })
    })
})

describe("ChatActivityService.receipt", () => {
    it("tells every active member that a cursor moved", async () => {
        const { service, hub } = await build()

        await service.receipt(WS, "conversation:cv-1")

        expect(published(hub)).toEqual(
            MEMBERS.map((member) => ({
                topic: chatActivityTopic(member.user_id, WS).name,
                kind: "receipt",
                target: "conversation:cv-1",
                at: NOW,
            })),
        )
    })
})

describe("ChatActivityService.unread", () => {
    it("tells only the named active member", async () => {
        const { service, hub } = await build()

        await service.unread(WS, "agent:a-1", "bob", inside)

        expect(published(hub)).toEqual([
            { topic: chatActivityTopic("bob", WS).name, kind: "unread", target: "agent:a-1", at: NOW },
        ])
    })

    it("tells nobody when the member is not active in the workspace", async () => {
        const { service, hub } = await build()

        await service.unread(WS, "room:sales", "stranger")

        expect(hub.publish).not.toHaveBeenCalled()
    })
})

describe("ChatActivityService after the commit", () => {
    it("holds every push until the writer's transaction committed", async () => {
        const { service, hub, commits } = await build()
        const held: Array<() => Promise<void>> = []
        commits.run.mockImplementation((_manager, task) => {
            held.push(task)
            return Promise.resolve()
        })

        await service.message(WS, "room:sales", "author", inside)

        expect(commits.run.mock.calls.map(([manager]) => manager)).toEqual([inside])
        expect(hub.publish).not.toHaveBeenCalled()
        await held[0]?.()
        expect(hub.publish).toHaveBeenCalledTimes(5)
    })

    it("pushes nothing when the transaction rolls back and the held work is dropped", async () => {
        const { service, hub, commits } = await build()
        commits.run.mockResolvedValue(undefined)

        await service.receipt(WS, "room:sales", inside)
        await service.unread(WS, "room:sales", "bob", inside)

        expect(hub.publish).not.toHaveBeenCalled()
    })

    it("runs at once on the primary manager when the writer is not inside a transaction", async () => {
        const { service, entityManager, commits } = await build()

        await service.receipt(WS, "room:sales")

        expect(commits.run.mock.calls.map(([manager]) => manager)).toEqual([entityManager])
    })
})
