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

const FIRST_ID = "00000000-0000-4000-8000-000000000001"
const SECOND_ID = "00000000-0000-4000-8000-000000000002"

interface Options {
    /** What the lists answer to a tag of one agent by another. */
    readonly canTag?: boolean
    /** The agent that holds the conversation; null when nobody does. */
    readonly holder?: string | null
}

/** The service with a right port and a visibility port bound, both answering as `options` says. */
const build = async ({ canTag = true, holder = null }: Options = {}) => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.keep.mockResolvedValue(undefined)
    queue.takeNext.mockResolvedValue(null)
    const rights = mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(canTag) })
    const visibility = mock<AgentTagVisibilityPort>()
    visibility.announce.mockResolvedValue(undefined)
    visibility.redirect.mockResolvedValue(undefined)
    visibility.holderOf.mockResolvedValue(holder)
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

/** The service with neither port bound: an agent tag is refused, and nothing shows in a conversation. */
const buildUnbound = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.takeNext.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentSpeakerQueueService, useValue: queue },
            { provide: AGENT_TAG_RIGHTS, useValue: null },
            { provide: AGENT_TAG_VISIBILITY, useValue: null },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTagService), wakes, queue }
}

const NOTICE = {
    workspaceId: "ws-1",
    conversationId: "c1",
    fromAgentId: "chat",
    toAgentId: "sales",
    text: "Order for 5 baskets",
}

describe("AgentTagService.tagAgent, the wake it writes", () => {
    it("wakes the target at its tag trigger with the words, the conversation and the agent behind the tag", async () => {
        const { service, wakes, rights } = await build()

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

    it("records the person behind an @ tag and the source of a system tag, with no right to check", async () => {
        const { service, wakes } = await build()
        const { eventKey: _unused, ...open } = BASE

        await service.tagAgent({ ...open, personId: "m1" })
        await service.tagAgent({ ...open, source: "bank-feed" }, mockEntityManager())

        expect(wakes.write).toHaveBeenNthCalledWith(1, expect.anything(), {
            workspaceId: "ws-1",
            agentId: "sales",
            source: "tag",
            eventKey: `tag:${FIRST_ID}`,
            context: { text: "Order for 5 baskets", locale: "vi" },
            actorMemberId: "m1",
        })
        expect(wakes.write).toHaveBeenNthCalledWith(2, expect.anything(), {
            workspaceId: "ws-1",
            agentId: "sales",
            source: "tag",
            eventKey: `tag:${SECOND_ID}`,
            context: { text: "Order for 5 baskets", locale: "vi", tagSource: "bank-feed" },
            actorMemberId: null,
        })
    })
})

describe("AgentTagService.tagAgent, what it answers", () => {
    it("hands the plain data of the tag to the target and refuses data a wake cannot keep", async () => {
        const { service, wakes } = await build()

        await service.tagAgent({ ...BASE, source: "bank-feed", context: { items: [{ sku: "x" }] } })
        await expect(
            service.tagAgent({ ...BASE, source: "bank-feed", context: { blob: "x".repeat(9000) } }),
        ).resolves.toEqual({ tagged: false, reason: "too_large" })

        expect(wakes.write).toHaveBeenCalledTimes(1)
        expect(wakes.write).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "sales",
            source: "tag",
            eventKey: "order:1",
            context: {
                text: "Order for 5 baskets",
                tagContext: '{"items":[{"sku":"x"}]}',
                locale: "vi",
                tagSource: "bank-feed",
            },
            actorMemberId: null,
        })
    })

    it("answers a duplicate when the same fact was already written", async () => {
        const { service, wakes } = await build()
        wakes.write.mockResolvedValue(null)

        await expect(service.tagAgent({ ...BASE, source: "bank-feed" })).resolves.toEqual({
            tagged: false,
            reason: "duplicate",
        })
    })
})

describe("AgentTagService.tagAgent, the right to tag", () => {
    it("refuses an agent the lists do not allow, an agent that tags itself, and any agent when no right is bound", async () => {
        const denying = await build({ canTag: false })
        const itself = await build()
        const unbound = await buildUnbound()

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
        expect(itself.rights.canTag).not.toHaveBeenCalled()
        expect(unbound.wakes.write).not.toHaveBeenCalled()
    })
})

describe("AgentTagService.tagAgent, visibility", () => {
    it("hand over: posts a visible tag line by default and for chat, and passes the right to speak to the target", async () => {
        const { service, visibility } = await build()

        await service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })
        await service.tagAgent({
            ...BASE,
            eventKey: "order:2",
            fromAgentId: "chat",
            conversationId: "c1",
            visibility: "chat",
        })

        expect(visibility.announce).toHaveBeenCalledTimes(2)
        expect(visibility.announce).toHaveBeenCalledWith(NOTICE, expect.anything())
        expect(visibility.redirect).toHaveBeenCalledTimes(2)
        expect(visibility.redirect).toHaveBeenCalledWith(NOTICE)
    })

    it("moves the conversation and posts no line on a redirect, with the same wake as a chat tag", async () => {
        const { service, wakes, visibility } = await build()

        await service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1", visibility: "redirect" })

        expect(visibility.redirect).toHaveBeenCalledWith(NOTICE)
        expect(visibility.announce).not.toHaveBeenCalled()
        expect(wakes.write).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "sales",
            source: "tag",
            eventKey: "order:1",
            context: { text: "Order for 5 baskets", conversationId: "c1", authorAgentId: "chat", locale: "vi" },
            actorMemberId: null,
        })
    })

    it("shows nothing for a tag with no conversation, with no port bound, or that wrote no wake", async () => {
        const bound = await build()
        const unbound = await buildUnbound()
        const duplicate = await build()
        duplicate.wakes.write.mockResolvedValue(null)

        await bound.service.tagAgent({ ...BASE, fromAgentId: "chat" })
        await unbound.service.tagAgent({ ...BASE, source: "bank-feed", conversationId: "c1" })
        await duplicate.service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })

        expect(bound.visibility.announce).not.toHaveBeenCalled()
        expect(bound.visibility.redirect).not.toHaveBeenCalled()
        expect(duplicate.visibility.announce).not.toHaveBeenCalled()
        expect(duplicate.visibility.redirect).not.toHaveBeenCalled()
    })

    it("leaves who handed off empty for a person or a system tag", async () => {
        const { service, visibility } = await build()

        await service.tagAgent({ ...BASE, source: "bank-feed", conversationId: "c1" })

        expect(visibility.announce).toHaveBeenCalledWith({ ...NOTICE, fromAgentId: null }, expect.anything())
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

describe("AgentTagService one speaker", () => {
    it("two handoffs in one run: the second waits while the first target holds the conversation, and wakes nobody yet", async () => {
        const { service, wakes, queue, visibility } = await build({ holder: "sales" })

        await expect(service.tagAgent(QUEUED)).resolves.toEqual({ tagged: false, reason: "queued" })

        expect(queue.keep).toHaveBeenCalledWith(QUEUED, expect.anything())
        expect(wakes.write).not.toHaveBeenCalled()
        expect(visibility.redirect).not.toHaveBeenCalled()
        expect(visibility.announce).not.toHaveBeenCalled()
    })

    it("keeps a waiting hand-off under a key of its own when it came with none", async () => {
        const { service, queue } = await build({ holder: "sales" })
        const { eventKey: _unused, ...keyless } = QUEUED

        await service.tagAgent(keyless)

        expect(queue.keep).toHaveBeenCalledWith({ ...keyless, eventKey: `tag:${FIRST_ID}` }, expect.anything())
    })

    it("a hand-off from the holder or to it goes at once", async () => {
        const fromHolder = await build({ holder: "chat" })
        const toHolder = await build({ holder: "accounting" })

        await expect(fromHolder.service.tagAgent(QUEUED)).resolves.toEqual({ tagged: true, wakeId: "wake-1" })
        await expect(toHolder.service.tagAgent(QUEUED)).resolves.toEqual({ tagged: true, wakeId: "wake-1" })
        expect(fromHolder.queue.keep).not.toHaveBeenCalled()
    })
})

describe("AgentTagService one speaker, the hand-on", () => {
    it("hand on: the holder's work done, the waiting hand-off gets its wake and the right to speak", async () => {
        const { service, wakes, queue, visibility } = await build({ holder: "sales" })
        queue.takeNext.mockResolvedValue(QUEUED)

        await service.release("ws-1", "c1", "sales")

        expect(wakes.write).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "accounting",
            source: "tag",
            eventKey: "claim:1",
            context: { text: "Claim of 5,000", conversationId: "c1", authorAgentId: "chat", locale: "vi" },
            actorMemberId: null,
        })
        const notice = {
            workspaceId: "ws-1",
            conversationId: "c1",
            fromAgentId: "sales",
            toAgentId: "accounting",
            text: "Claim of 5,000",
        }
        expect(visibility.announce).toHaveBeenCalledWith(notice, expect.anything())
        expect(visibility.redirect).toHaveBeenCalledWith(notice)
        expect(visibility.handBack).not.toHaveBeenCalled()
    })

    it("hand on: a waiting redirect passes the right to speak and posts no line", async () => {
        const { service, queue, visibility } = await build({ holder: "sales" })
        queue.takeNext.mockResolvedValue({ ...QUEUED, visibility: "redirect" })

        await service.release("ws-1", "c1", "sales")

        expect(visibility.announce).not.toHaveBeenCalled()
        expect(visibility.redirect).toHaveBeenCalledTimes(1)
    })

    it("hand back: the holder's work done and nobody waiting, the conversation goes back to the agent that opened the door", async () => {
        const { service, wakes, visibility } = await build({ holder: "sales" })

        await service.release("ws-1", "c1", "sales")

        expect(visibility.handBack).toHaveBeenCalledWith("ws-1", "c1", "sales")
        expect(wakes.write).not.toHaveBeenCalled()
    })

    it("an agent that does not hold the conversation releases nothing, and nothing happens with no port bound", async () => {
        const notHolder = await build({ holder: "sales" })
        const unbound = await buildUnbound()

        await notHolder.service.release("ws-1", "c1", "chat")
        await unbound.service.release("ws-1", "c1", "sales")

        expect(notHolder.queue.takeNext).not.toHaveBeenCalled()
        expect(unbound.queue.takeNext).not.toHaveBeenCalled()
        expect(notHolder.visibility.handBack).not.toHaveBeenCalled()
    })
})
