import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Like, MoreThanOrEqual } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChannelReceiptsService } from "./channel-receipts.service"
import { ChannelReceiptEntity } from "./persistence/entities"

const build = async (held: boolean) => {
    const em = mockEntityManager({
        exists: [ChannelReceiptEntity, held],
        insert: [ChannelReceiptEntity, {}],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [ChannelReceiptsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ChannelReceiptsService), em }
}

describe("ChannelReceiptsService", () => {
    it("tells whether a holding line already went out in the conversation since a moment", async () => {
        const since = new Date("2026-10-12T09:00:00.000Z")
        const sent = await build(true)
        const none = await build(false)

        await expect(sent.service.heldSince("ws-1", "conv-1", since)).resolves.toBe(true)
        await expect(none.service.heldSince("ws-1", "conv-1", since)).resolves.toBe(false)
        expect(sent.em.exists).toHaveBeenCalledWith(ChannelReceiptEntity, {
            where: {
                workspaceId: "ws-1",
                channel: "holding",
                receiptId: Like("conv-1:%"),
                createdAt: MoreThanOrEqual(since),
            },
        })
    })

    it("remembers a holding line by conversation and time", async () => {
        const { service, em } = await build(false)

        await service.rememberHolding("ws-1", "conv-1", new Date(1_760_000_000_000))

        expect(em.insert).toHaveBeenCalledWith(ChannelReceiptEntity, {
            workspaceId: "ws-1",
            channel: "holding",
            receiptId: "conv-1:1760000000000",
        })
    })
})
