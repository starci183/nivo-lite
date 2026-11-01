import { Test } from "@nestjs/testing"
import { failedZaloReply, untriedZaloReply } from "@tests/fixtures/builders/agent-messages.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentMessagesFeedReadService } from "./agent-messages-feed-read.service"
import { AgentMessageEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentMessagesFeedReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentMessagesFeedReadService)
}

/** A manager whose one query builder answers these terminals. */
const answering = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("AgentMessagesFeedReadService > recentIn", () => {
    it("lists the newest customer and agent messages across the conversations, bounded", async () => {
        const rows = [
            {
                id: "m1",
                conversationId: "c1",
                role: "user",
                body: "Hi",
                createdAt: "x",
                deliveryStatus: null,
                deliveryError: null,
            },
        ]
        const { em, fake } = answering({ getRawMany: rows })

        await expect((await build(em)).recentIn(["c1", "c2"], 40)).resolves.toEqual(rows)
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ conversationIds: ["c1", "c2"] })
        expect(fake.callsOf("orderBy")).toEqual([["m.created_at", "DESC"]])
        expect(fake.callsOf("limit")).toEqual([[40]])
    })

    it("reads nothing for no conversations", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).recentIn([], 40)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AgentMessagesFeedReadService > lastDeliveredReplyIn", () => {
    it("answers the verdict of the newest agent reply whose delivery was tried", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, failedZaloReply()] })

        await expect((await build(em)).lastDeliveredReplyIn(["c1"])).resolves.toEqual({
            deliveryStatus: "failed",
            deliveryError: "zalo_error",
        })
        expect(em.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, deliveryStatus: true, deliveryError: true },
            where: { conversationId: In(["c1"]), role: "agent", deliveryStatus: Not(IsNull()) },
            order: { createdAt: "DESC" },
        })
    })

    it("answers null when there is none, the status is blank or there are no conversations", async () => {
        const none = mockEntityManager({ findOne: [AgentMessageEntity, null] })
        const blank = mockEntityManager({ findOne: [AgentMessageEntity, untriedZaloReply()] })

        await expect((await build(none)).lastDeliveredReplyIn(["c1"])).resolves.toBeNull()
        await expect((await build(blank)).lastDeliveredReplyIn(["c1"])).resolves.toBeNull()
        await expect((await build(mockEntityManager())).lastDeliveredReplyIn([])).resolves.toBeNull()
    })
})

describe("AgentMessagesFeedReadService > lastCustomerAtIn", () => {
    it("answers when the customer last wrote, and null when they never did", async () => {
        const wrote = new Date("2026-10-30T08:15:00.000Z")
        const found = mockEntityManager({ findOne: [AgentMessageEntity, { ...failedZaloReply(), createdAt: wrote }] })
        const none = mockEntityManager({ findOne: [AgentMessageEntity, null] })

        await expect((await build(found)).lastCustomerAtIn("c1")).resolves.toEqual(wrote)
        await expect((await build(none)).lastCustomerAtIn("c1")).resolves.toBeNull()
        expect(found.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { createdAt: true },
            where: { conversationId: "c1", role: "user" },
            order: { createdAt: "DESC" },
        })
    })
})

describe("AgentMessagesFeedReadService > lastWritesSince", () => {
    it("answers when each customer last wrote after the moment, newest first, bounded", async () => {
        const rows = [{ conversationId: "c1", lastAt: "2026-10-28 09:00:00+00" }]
        const { em, fake } = answering({ getRawMany: rows })

        await expect(
            (await build(em)).lastWritesSince(["c1"], new Date("2026-10-26T10:00:00.000Z"), 40),
        ).resolves.toEqual(rows)
        expect(fake.callsOf("where")[0]?.[1]).toEqual({
            conversationIds: ["c1"],
            since: "2026-10-26T10:00:00.000Z",
        })
        expect(fake.callsOf("limit")).toEqual([[40]])
    })

    it("reads nothing for no conversations", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).lastWritesSince([], new Date(0), 40)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
