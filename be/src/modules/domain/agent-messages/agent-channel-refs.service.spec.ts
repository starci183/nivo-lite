import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentChannelRefsService } from "./agent-channel-refs.service"
import { AgentMessageEntity } from "./persistence/entities"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentChannelRefsService] }).compile()
    return moduleRef.get(AgentChannelRefsService)
}

describe("AgentChannelRefsService", () => {
    it("finds the customer message of the conversation that stores the channel message", async () => {
        const manager = mockEntityManager({
            findOne: [AgentMessageEntity, Object.assign(new AgentMessageEntity(), { id: "msg-1" })],
        })

        await expect((await build()).messageOf("conv-1", "zalo:m-1", manager)).resolves.toBe("msg-1")
        expect(manager.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true },
            where: { conversationId: "conv-1", channelRef: "zalo:m-1", role: "user" },
        })
    })

    it("answers null for a channel message the conversation does not store yet", async () => {
        const manager = mockEntityManager({ findOne: [AgentMessageEntity, null] })

        await expect((await build()).messageOf("conv-1", "zalo:m-2", manager)).resolves.toBeNull()
    })

    it("notes the channel message on the customer message just stored", async () => {
        const manager = mockEntityManager({ update: [AgentMessageEntity, { affected: 1 }] })

        await expect((await build()).mark("msg-1", "zalo:m-1", manager)).resolves.toBeUndefined()
        expect(manager.update).toHaveBeenCalledWith(AgentMessageEntity, { id: "msg-1" }, { channelRef: "zalo:m-1" })
    })
})
