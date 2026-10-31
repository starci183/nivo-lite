import { Test } from "@nestjs/testing"
import { row } from "@tests/fixtures/builders/knowledge-sources.builder"
import { FakeClock, fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { knowledgeProgressTopic } from "./knowledge-progress.policy"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-31T10:00:00.000Z"
const KEY = { id: "s1", workspaceId: WS }
const stored: KnowledgeSourceEntity = {
    ...row,
    status: "indexing",
    progress: 50,
    stage: "embed",
    stageDone: 3,
    stageTotal: 6,
    updatedAt: new Date(AT),
}
const STATE = {
    sourceId: "s1",
    status: "indexing",
    progress: 50,
    stage: "embed",
    done: 3,
    total: 6,
    error: null,
    chunkCount: 0,
    at: AT,
}

const build = async (em: MockEntityManager) => {
    const hub = mock<RealtimeHub>()
    const logger = mock<Logger>()
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeUsers.mockResolvedValue([{ userId: "u1", displayName: "A" }, { userId: "u2", displayName: "B" }])
    const clock = new FakeClock(AT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeProgressService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: REALTIME_HUB, useValue: hub },
            { provide: CLOCK, useValue: clock },
            { provide: IDS, useValue: fakeIds() },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeProgressService), hub, logger, seats, clock }
}

describe("KnowledgeProgressService write", () => {
    it("stores the change first and pushes the state the row holds second, one frame per active member", async () => {
        const em = mockEntityManager({
            update: [KnowledgeSourceEntity, { affected: 1 }],
            findOne: [KnowledgeSourceEntity, stored],
        })
        const { service, hub } = await build(em)
        const order: Array<string> = []
        em.update.mockImplementation(() => {
            order.push("update")
            return Promise.resolve({ affected: 1, raw: [], generatedMaps: [] })
        })
        hub.publish.mockImplementation(() => {
            order.push("publish")
            return Promise.resolve()
        })

        await service.write(WS, "s1", { stage: "embed", done: 3, total: 6, progress: 50 })

        expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, KEY, {
            stage: "embed",
            stageDone: 3,
            stageTotal: 6,
            progress: 50,
            updatedAt: NOW,
        })
        expect(order).toEqual(["update", "publish", "publish"])
        const progressId: unknown = expect.stringMatching(/^progress:/)
        const frame = { ...STATE, id: progressId, kind: "progress" }
        expect(hub.publish).toHaveBeenCalledWith(expect.objectContaining({ name: knowledgeProgressTopic("u1", WS).name }), frame)
        expect(hub.publish).toHaveBeenCalledWith(expect.objectContaining({ name: knowledgeProgressTopic("u2", WS).name }), frame)
    })

    it("does not push when the row could not be stored", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, stored] })
        em.update.mockRejectedValue(new Error("db"))
        const { service, hub } = await build(em)

        await expect(service.write(WS, "s1", { progress: 5 })).rejects.toThrow("db")

        expect(hub.publish).not.toHaveBeenCalled()
    })

    it("logs a push that failed and leaves the stored change standing", async () => {
        const em = mockEntityManager({
            update: [KnowledgeSourceEntity, { affected: 1 }],
            findOne: [KnowledgeSourceEntity, stored],
        })
        const { service, hub, logger } = await build(em)
        hub.publish.mockRejectedValue(new Error("hub"))

        await expect(service.write(WS, "s1", { progress: 5 })).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.PublishFailed, expect.any(Error), {
            sourceId: "s1",
        })
    })

    it("pushes nothing for a source that is gone", async () => {
        const em = mockEntityManager({
            update: [KnowledgeSourceEntity, { affected: 0 }],
            findOne: [KnowledgeSourceEntity, null],
        })
        const { service, hub } = await build(em)

        await service.write(WS, "s1", { status: "failed" })

        expect(hub.publish).not.toHaveBeenCalled()
    })
})

describe("KnowledgeProgressService count", () => {
    it("writes at most once a second per source", async () => {
        const em = mockEntityManager({
            update: [KnowledgeSourceEntity, { affected: 1 }],
            findOne: [KnowledgeSourceEntity, stored],
        })
        const { service, clock } = await build(em)

        await service.count(WS, "s1", { done: 1 })
        clock.advance(400)
        await service.count(WS, "s1", { done: 2 })
        clock.advance(600)
        await service.count(WS, "s1", { done: 3 })

        expect(em.update).toHaveBeenCalledTimes(2)
        expect(em.update).toHaveBeenLastCalledWith(KnowledgeSourceEntity, KEY, { stageDone: 3, updatedAt: NOW })
    })

    it("lets the first count of a new stage through at once after the earlier stage ended", async () => {
        const em = mockEntityManager({
            update: [KnowledgeSourceEntity, { affected: 1 }],
            findOne: [KnowledgeSourceEntity, stored],
        })
        const { service } = await build(em)

        await service.count(WS, "s1", { done: 1 })
        await service.write(WS, "s1", { stage: null })
        await service.count(WS, "s1", { done: 2 })

        expect(em.update).toHaveBeenCalledTimes(3)
    })

    it("never fails the job when the count cannot be stored", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, stored] })
        em.update.mockRejectedValue(new Error("db"))
        const { service, logger } = await build(em)

        await expect(service.count(WS, "s1", { done: 1 })).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.ProgressFailed, expect.any(Error), {
            sourceId: "s1",
        })
    })
})

describe("KnowledgeProgressService announce", () => {
    it("pushes the state of the row to the members of the workspace", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, stored] })
        const { service, hub, seats } = await build(em)

        await service.announce(WS, "s1")

        expect(seats.activeUsers).toHaveBeenCalledWith(WS, 500)
        expect(hub.publish).toHaveBeenCalledTimes(2)
    })
})
