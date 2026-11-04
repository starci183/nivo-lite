import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentSpeakerQueueService } from "./agent-speaker-queue.service"
import { AgentTagService } from "./agent-tag.service"
import { AgentWakeService } from "./agent-wake.service"
import { AGENT_TAG_RIGHTS, AGENT_TAG_VISIBILITY } from "./agent-work.decorators"
import type { AgentTagRights, AgentTagVisibilityPort } from "./agent-work.port"

const BASE = { workspaceId: "ws-1", toAgentId: "sales", text: "Order for 5 baskets", eventKey: "order:1" }

const build = async (rights: AgentTagRights | null, visibility: AgentTagVisibilityPort | null = null) => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>()
    wakes.write.mockResolvedValue("wake-1")
    const queue = mock<AgentSpeakerQueueService>()
    queue.keep.mockResolvedValue(undefined)
    queue.takeNext.mockResolvedValue(null)
    const providers = [
        AgentTagService,
        { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
        { provide: AgentWakeService, useValue: wakes },
        { provide: AgentSpeakerQueueService, useValue: queue },
        ...(rights === null ? [] : [{ provide: AGENT_TAG_RIGHTS, useValue: rights }]),
        ...(visibility === null ? [] : [{ provide: AGENT_TAG_VISIBILITY, useValue: visibility }]),
    ]
    const moduleRef = await Test.createTestingModule({ providers }).compile()
    return { service: moduleRef.get(AgentTagService), wakes, tx, queue }
}

describe("AgentTagService.tagAgent", () => {
    it("wakes the target at its tag trigger with the words, the conversation and the agent behind the tag", async () => {
        const rights = mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(true) })
        const { service, wakes } = await build(rights)

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
        const denying = await build(mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(false) }))
        const itself = await build(mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(true) }))
        const unbound = await build(null)

        await expect(denying.service.tagAgent({ ...BASE, fromAgentId: "chat" })).resolves.toEqual({
            tagged: false,
            reason: "not_allowed",
        })
        await expect(itself.service.tagAgent({ ...BASE, fromAgentId: "sales" })).resolves.toMatchObject({
            tagged: false,
        })
        await expect(unbound.service.tagAgent({ ...BASE, fromAgentId: "chat" })).resolves.toMatchObject({
            tagged: false,
        })
        expect(denying.wakes.write).not.toHaveBeenCalled()
        expect(unbound.wakes.write).not.toHaveBeenCalled()
    })

    it("records the person behind an @ tag and the source of a system tag, with no right to check", async () => {
        const { service, wakes } = await build(null)
        const { eventKey: _unused, ...open } = BASE

        await service.tagAgent({ ...open, personId: "m1" })
        await service.tagAgent({ ...open, source: "bank-feed" }, mockEntityManager())

        expect(wakes.write).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({ actorMemberId: "m1", eventKey: expect.stringMatching(/^tag:/u) }),
        )
        expect(wakes.write).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
                actorMemberId: null,
                context: { text: "Order for 5 baskets", locale: "vi", tagSource: "bank-feed" },
            }),
        )
    })

    it("hands the plain data of the tag to the target and refuses data a wake cannot keep", async () => {
        const { service, wakes } = await build(null)

        await service.tagAgent({ ...BASE, source: "bank-feed", context: { items: [{ sku: "x" }] } })
        await expect(
            service.tagAgent({ ...BASE, source: "bank-feed", context: { blob: "x".repeat(9000) } }),
        ).resolves.toEqual({ tagged: false, reason: "too_large" })

        expect(wakes.write).toHaveBeenCalledTimes(1)
        expect(wakes.write).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ context: expect.objectContaining({ tagContext: '{"items":[{"sku":"x"}]}' }) }),
        )
    })

    it("answers a duplicate when the same fact was already written", async () => {
        const { service, wakes } = await build(null)
        wakes.write.mockResolvedValue(null)

        await expect(service.tagAgent({ ...BASE, source: "bank-feed" })).resolves.toEqual({
            tagged: false,
            reason: "duplicate",
        })
    })

    describe("visibility", () => {
        const rights = () => mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(true) })
        const port = () => {
            const visibility = mock<AgentTagVisibilityPort>()
            visibility.announce.mockResolvedValue(undefined)
            visibility.redirect.mockResolvedValue(undefined)
            visibility.holderOf.mockResolvedValue(null)
            visibility.handBack.mockResolvedValue(undefined)
            return visibility
        }
        const notice = {
            workspaceId: "ws-1",
            conversationId: "c1",
            fromAgentId: "chat",
            toAgentId: "sales",
            text: "Order for 5 baskets",
        }

        it("hand over: posts a visible tag line by default and for chat, and passes the right to speak to the target", async () => {
            const visibility = port()
            const { service } = await build(rights(), visibility)

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
            const visibility = port()
            const { service, wakes } = await build(rights(), visibility)

            await service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1", visibility: "redirect" })

            expect(visibility.redirect).toHaveBeenCalledWith(notice)
            expect(visibility.announce).not.toHaveBeenCalled()
            expect(wakes.write).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    context: expect.objectContaining({ authorAgentId: "chat", conversationId: "c1" }),
                }),
            )
        })

        it("shows nothing for a tag with no conversation, with no port bound, or that wrote no wake", async () => {
            const visibility = port()
            const bound = await build(rights(), visibility)
            const unbound = await build(rights())
            const duplicate = await build(rights(), visibility)
            duplicate.wakes.write.mockResolvedValue(null)

            await bound.service.tagAgent({ ...BASE, fromAgentId: "chat" })
            await unbound.service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })
            await duplicate.service.tagAgent({ ...BASE, fromAgentId: "chat", conversationId: "c1" })

            expect(visibility.announce).not.toHaveBeenCalled()
            expect(visibility.redirect).not.toHaveBeenCalled()
        })

        it("leaves who handed off empty for a person or a system tag", async () => {
            const visibility = port()
            const { service } = await build(null, visibility)

            await service.tagAgent({ ...BASE, source: "bank-feed", conversationId: "c1" })

            expect(visibility.announce).toHaveBeenCalledWith({ ...notice, fromAgentId: null }, expect.anything())
            expect(visibility.redirect).not.toHaveBeenCalled()
        })
    })
})

describe("AgentTagService one speaker", () => {
    const rights = () => mock<AgentTagRights>({ canTag: jest.fn().mockResolvedValue(true) })
    const portHeldBy = (holder: string | null) => {
        const visibility = mock<AgentTagVisibilityPort>()
        visibility.announce.mockResolvedValue(undefined)
        visibility.redirect.mockResolvedValue(undefined)
        visibility.holderOf.mockResolvedValue(holder)
        visibility.handBack.mockResolvedValue(undefined)
        return visibility
    }
    const QUEUED = {
        workspaceId: "ws-1",
        fromAgentId: "chat",
        toAgentId: "accounting",
        text: "Claim of 5,000",
        conversationId: "c1",
        eventKey: "claim:1",
    }

    it("two handoffs in one run: the second waits while the first target holds the conversation, and wakes nobody yet", async () => {
        const visibility = portHeldBy("sales")
        const { service, wakes, queue } = await build(rights(), visibility)

        await expect(service.tagAgent(QUEUED)).resolves.toEqual({ tagged: false, reason: "queued" })

        expect(queue.keep).toHaveBeenCalledWith(QUEUED, expect.anything())
        expect(wakes.write).not.toHaveBeenCalled()
        expect(visibility.redirect).not.toHaveBeenCalled()
        expect(visibility.announce).not.toHaveBeenCalled()
    })

    it("a hand-off from the holder or to it goes at once", async () => {
        const fromHolder = await build(rights(), portHeldBy("chat"))
        const toHolder = await build(rights(), portHeldBy("accounting"))

        await expect(fromHolder.service.tagAgent(QUEUED)).resolves.toEqual({ tagged: true, wakeId: "wake-1" })
        await expect(toHolder.service.tagAgent(QUEUED)).resolves.toEqual({ tagged: true, wakeId: "wake-1" })
        expect(fromHolder.queue.keep).not.toHaveBeenCalled()
    })

    it("hand on: the holder's work done, the waiting hand-off gets its wake and the right to speak", async () => {
        const visibility = portHeldBy("sales")
        const { service, wakes, queue } = await build(rights(), visibility)
        queue.takeNext.mockResolvedValue(QUEUED)

        await service.release("ws-1", "c1", "sales")

        expect(wakes.write).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ agentId: "accounting", eventKey: "claim:1" }),
        )
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

    it("hand back: the holder's work done and nobody waiting, the conversation goes back to the agent that opened the door", async () => {
        const visibility = portHeldBy("sales")
        const { service, wakes } = await build(rights(), visibility)

        await service.release("ws-1", "c1", "sales")

        expect(visibility.handBack).toHaveBeenCalledWith("ws-1", "c1", "sales")
        expect(wakes.write).not.toHaveBeenCalled()
    })

    it("an agent that does not hold the conversation releases nothing, and nothing happens with no port bound", async () => {
        const visibility = portHeldBy("sales")
        const notHolder = await build(rights(), visibility)
        const unbound = await build(rights())

        await notHolder.service.release("ws-1", "c1", "chat")
        await unbound.service.release("ws-1", "c1", "sales")

        expect(notHolder.queue.takeNext).not.toHaveBeenCalled()
        expect(unbound.queue.takeNext).not.toHaveBeenCalled()
        expect(visibility.handBack).not.toHaveBeenCalled()
    })
})
