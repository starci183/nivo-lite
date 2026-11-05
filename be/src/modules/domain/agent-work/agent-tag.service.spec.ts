import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { AgentSpeakerQueueService } from "./agent-speaker-queue.service"
import { AgentTagService } from "./agent-tag.service"
import { AgentWakeService } from "./agent-wake.service"
import { AGENT_TAG_RIGHTS, AGENT_TAG_VISIBILITY } from "./agent-work.decorators"
import type { AgentTagRights, AgentTagVisibilityPort } from "./agent-work.port"

const BASE = { workspaceId: "ws-1", toAgentId: "sales", text: "Order for 5 baskets", eventKey: "order:1" }
const ID_1 = "00000000-0000-4000-8000-000000000001"
const ID_2 = "00000000-0000-4000-8000-000000000002"

/** No right port, no visibility port. */
const buildBare = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.keep.mockResolvedValue(undefined)
    queue.takeNext.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentSpeakerQueueService, useValue: queue },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTagService), wakes, tx, queue }
}

/** The right port only: every tag allowed until a spec says otherwise. */
const buildWithRights = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.keep.mockResolvedValue(undefined)
    queue.takeNext.mockResolvedValue(null)
    const rights = mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentSpeakerQueueService, useValue: queue },
            { provide: AGENT_TAG_RIGHTS, useValue: rights },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTagService), wakes, tx, queue, rights }
}

/** The visibility port only: nobody holds the conversation until a spec says otherwise. */
const buildWithPort = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.keep.mockResolvedValue(undefined)
    queue.takeNext.mockResolvedValue(null)
    const visibility = mock<AgentTagVisibilityPort>()
    visibility.announce.mockResolvedValue(undefined)
    visibility.redirect.mockResolvedValue(undefined)
    visibility.holderOf.mockResolvedValue(null)
    visibility.handBack.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentSpeakerQueueService, useValue: queue },
            { provide: AGENT_TAG_VISIBILITY, useValue: visibility },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTagService), wakes, tx, queue, visibility }
}

/** Both ports. */
const buildFull = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.keep.mockResolvedValue(undefined)
    queue.takeNext.mockResolvedValue(null)
    const rights = mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(true) })
    const visibility = mock<AgentTagVisibilityPort>()
    visibility.announce.mockResolvedValue(undefined)
    visibility.redirect.mockResolvedValue(undefined)
    visibility.holderOf.mockResolvedValue(null)
    visibility.handBack.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentSpeakerQueueService, useValue: queue },
            { provide: AGENT_TAG_RIGHTS, useValue: rights },
            { provide: AGENT_TAG_VISIBILITY, useValue: visibility },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTagService), wakes, tx, queue, rights, visibility }
}

describe("AgentTagService.tagAgent", () => {
    it("wakes the target at its tag trigger with the words, the conversation and the agent behind the tag", async () => {
        const { service, wakes, rights } = await buildWithRights()

        await expect(
            service.tagAgent({ ...BASE, fromAgentId: "chat", subject: "order-1", conversationId: "c1" }),
        ).resolves.toEqual({ tagged: true, wakeId: "wake-1" })

        expect(rights.canTag).toHaveBeenCalledWith("chat", "sales")
        expect(wakes.write).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "sales",
            source: "tag",
            eventKey: "order:1",
            context: {
                text: "Order for 5 baskets",
                subject: "order-1",
                conversationId: "c1",
                authorAgentId: "chat",
                locale: "vi",
            },
            actorMemberId: null,
        })
    })

    it("refuses an agent the lists do not allow, an agent that tags itself, and any agent when no right is bound", async () => {
        const denying = await buildWithRights()
        denying.rights.canTag.mockResolvedValue(false)
        const itself = await buildWithRights()
        const unbound = await buildBare()

        await expect(denying.service.tagAgent({ ...BASE, fromAgentId: "chat" })).resolves.toEqual({
            tagged: false,
            reason: "not_allowed",
        })
        await expect(itself.service.tagAgent({ ...BASE, fromAgentId: "sales" })).resolves.toEqual({
            tagged: false,
            reason: "not_allowed",
        })
        await expect(unbound.service.tagAgent({ ...BASE, fromAgentId: "chat" })).resolves.toEqual({
            tagged: false,
            reason: "not_allowed",
        })
        expect(denying.wakes.write).not.toHaveBeenCalled()
        expect(unbound.wakes.write).not.toHaveBeenCalled()
    })

    it("records the person behind an @ tag and the source of a system tag, with no right to check", async () => {
        const { service, wakes } = await buildBare()
        const { eventKey: _unused, ...open } = BASE

        await service.tagAgent({ ...open, personId: "m1" })
        await service.tagAgent({ ...open, source: "bank-feed" }, mockEntityManager())

        expect(wakes.write.mock.calls[0]?.[1]).toMatchObject({ actorMemberId: "m1", eventKey: `tag:${ID_1}` })
        expect(wakes.write.mock.calls[1]?.[1]).toEqual({
            workspaceId: "ws-1",
            agentId: "sales",
            source: "tag",
            eventKey: `tag:${ID_2}`,
            context: { text: "Order for 5 baskets", locale: "vi", tagSource: "bank-feed" },
            actorMemberId: null,
        })
    })
})

describe("AgentTagService.tagAgent data and duplicates", () => {
    it("hands the plain data of the tag to the target and refuses data a wake cannot keep", async () => {
        const { service, wakes } = await buildBare()

        await service.tagAgent({ ...BASE, source: "bank-feed", context: { items: [{ sku: "x" }] } })
        await expect(
            service.tagAgent({ ...BASE, source: "bank-feed", context: { blob: "x".repeat(9000) } }),
        ).resolves.toEqual({ tagged: false, reason: "too_large" })

        expect(wakes.write).toHaveBeenCalledTimes(1)
        expect(wakes.write.mock.calls[0]?.[1].context).toMatchObject({ tagContext: '{"items":[{"sku":"x"}]}' })
    })

    it("answers a duplicate when the same fact was already written", async () => {
        const { service, wakes } = await buildBare()
        wakes.write.mockResolvedValue(null)

        await expect(service.tagAgent({ ...BASE, source: "bank-feed" })).resolves.toEqual({
            tagged: false,
            reason: "duplicate",
        })
    })
})

describe("AgentTagService.tagAgent visibility", () => {
    const notice = {
        workspaceId: "ws-1",
        conversationId: "c1",
        fromAgentId: "chat",
        toAgentId: "sales",
        text: "Order for 5 baskets",
    }

    it("hand over: posts a visible tag line by default and for chat, and passes the right to speak to the target", async () => {
        const { service, visibility } = await buildFull()

        await service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })
        await service.tagAgent({
            ...BASE,
            eventKey: "order:2",
            fromAgentId: "chat",
            conversationId: "c1",
            visibility: "chat",
        })

        expect(visibility.announce).toHaveBeenCalledTimes(2)
        expect(visibility.announce).toHaveBeenCalledWith(notice, expect.anything())
        expect(visibility.redirect).toHaveBeenCalledTimes(2)
        expect(visibility.redirect).toHaveBeenCalledWith(notice)
    })

    it("moves the conversation and posts no line on a redirect, with the same wake as a chat tag", async () => {
        const { service, wakes, visibility } = await buildFull()

        await service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1", visibility: "redirect" })

        expect(visibility.redirect).toHaveBeenCalledWith(notice)
        expect(visibility.announce).not.toHaveBeenCalled()
        expect(wakes.write.mock.calls[0]?.[1].context).toMatchObject({ authorAgentId: "chat", conversationId: "c1" })
    })

    it("shows nothing for a tag with no conversation, with no port bound, or that wrote no wake", async () => {
        const bound = await buildFull()
        const unbound = await buildWithRights()
        const duplicate = await buildFull()
        duplicate.wakes.write.mockResolvedValue(null)

        await bound.service.tagAgent({ ...BASE, fromAgentId: "chat" })
        await expect(unbound.service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })).resolves.toEqual(
            { tagged: true, wakeId: "wake-1" },
        )
        await duplicate.service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })

        expect(bound.visibility.announce).not.toHaveBeenCalled()
        expect(bound.visibility.redirect).not.toHaveBeenCalled()
        expect(duplicate.visibility.announce).not.toHaveBeenCalled()
        expect(duplicate.visibility.redirect).not.toHaveBeenCalled()
    })

    it("leaves who handed off empty for a person or a system tag", async () => {
        const { service, visibility } = await buildWithPort()

        await service.tagAgent({ ...BASE, source: "bank-feed", conversationId: "c1" })

        expect(visibility.announce).toHaveBeenCalledWith({ ...notice, fromAgentId: null }, expect.anything())
        expect(visibility.redirect).not.toHaveBeenCalled()
    })
})

const QUEUED = {
    workspaceId: "ws-1",
    fromAgentId: "chat",
    toAgentId: "accounting",
    text: "Claim of 5,000",
    conversationId: "c1",
    eventKey: "claim:1",
}

describe("AgentTagService one speaker, a hand-off while another agent holds the conversation", () => {
    it("two handoffs in one run: the second waits while the first target holds the conversation, and wakes nobody yet", async () => {
        const { service, wakes, queue, visibility } = await buildFull()
        visibility.holderOf.mockResolvedValue("sales")

        await expect(service.tagAgent(QUEUED)).resolves.toEqual({ tagged: false, reason: "queued" })

        expect(queue.keep).toHaveBeenCalledWith(QUEUED, expect.anything())
        expect(wakes.write).not.toHaveBeenCalled()
        expect(visibility.redirect).not.toHaveBeenCalled()
        expect(visibility.announce).not.toHaveBeenCalled()
    })

    it("keeps a waiting hand-off that came without an event key under a fresh tag key", async () => {
        const { service, queue, visibility } = await buildFull()
        visibility.holderOf.mockResolvedValue("sales")
        const { eventKey: _eventKey, ...keyless } = QUEUED

        await expect(service.tagAgent(keyless)).resolves.toEqual({ tagged: false, reason: "queued" })

        expect(queue.keep.mock.calls[0]?.[0]).toEqual({ ...keyless, eventKey: `tag:${ID_1}` })
    })

    it("a hand-off from the holder or to it goes at once", async () => {
        const fromHolder = await buildFull()
        fromHolder.visibility.holderOf.mockResolvedValue("chat")
        const toHolder = await buildFull()
        toHolder.visibility.holderOf.mockResolvedValue("accounting")

        await expect(fromHolder.service.tagAgent(QUEUED)).resolves.toEqual({ tagged: true, wakeId: "wake-1" })
        await expect(toHolder.service.tagAgent(QUEUED)).resolves.toEqual({ tagged: true, wakeId: "wake-1" })
        expect(fromHolder.queue.keep).not.toHaveBeenCalled()
    })
})

describe("AgentTagService one speaker, the holder's work is done", () => {
    const handedOn = {
        workspaceId: "ws-1",
        conversationId: "c1",
        fromAgentId: "sales",
        toAgentId: "accounting",
        text: "Claim of 5,000",
    }

    it("hand on: the waiting hand-off gets its wake and the right to speak", async () => {
        const { service, wakes, queue, visibility } = await buildFull()
        visibility.holderOf.mockResolvedValue("sales")
        queue.takeNext.mockResolvedValue(QUEUED)

        await service.release("ws-1", "c1", "sales")

        expect(wakes.write.mock.calls[0]?.[1]).toMatchObject({ agentId: "accounting", eventKey: "claim:1" })
        expect(visibility.announce).toHaveBeenCalledWith(handedOn, expect.anything())
        expect(visibility.redirect).toHaveBeenCalledWith(handedOn)
        expect(visibility.handBack).not.toHaveBeenCalled()
    })

    it("hand on: a waiting redirect passes the right to speak and posts no line", async () => {
        const { service, queue, visibility } = await buildFull()
        visibility.holderOf.mockResolvedValue("sales")
        queue.takeNext.mockResolvedValue({ ...QUEUED, visibility: "redirect" })

        await service.release("ws-1", "c1", "sales")

        expect(visibility.announce).not.toHaveBeenCalled()
        expect(visibility.redirect).toHaveBeenCalledWith(handedOn)
    })

    it("hand back: nobody waiting, the conversation goes back to the agent that opened the door", async () => {
        const { service, wakes, visibility } = await buildFull()
        visibility.holderOf.mockResolvedValue("sales")

        await service.release("ws-1", "c1", "sales")

        expect(visibility.handBack).toHaveBeenCalledWith("ws-1", "c1", "sales")
        expect(wakes.write).not.toHaveBeenCalled()
    })

    it("an agent that does not hold the conversation releases nothing, and nothing happens with no port bound", async () => {
        const notHolder = await buildFull()
        notHolder.visibility.holderOf.mockResolvedValue("sales")
        const unbound = await buildWithRights()

        await notHolder.service.release("ws-1", "c1", "chat")
        await unbound.service.release("ws-1", "c1", "sales")

        expect(notHolder.queue.takeNext).not.toHaveBeenCalled()
        expect(unbound.queue.takeNext).not.toHaveBeenCalled()
        expect(notHolder.visibility.handBack).not.toHaveBeenCalled()
    })
})
