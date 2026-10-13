import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChannelReceiptsService } from "./channel-receipts.service"
import { FIND_RECENT_HOLDING, INSERT_HOLDING_RECEIPT } from "./persistence/channel-receipts.sql"

const build = async (recent: ReadonlyArray<unknown>) => {
    const em = mockEntityManager({
        query: [
            [FIND_RECENT_HOLDING, recent],
            [INSERT_HOLDING_RECEIPT, []],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [ChannelReceiptsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ChannelReceiptsService), em }
}

describe("ChannelReceiptsService", () => {
    it("tells whether a holding line already went out in the conversation since a moment", async () => {
        const since = new Date("2026-10-12T09:00:00.000Z")
        const sent = await build([{ receipt_id: "conv-1:1" }])
        const none = await build([])

        await expect(sent.service.heldSince("ws-1", "conv-1", since)).resolves.toBe(true)
        await expect(none.service.heldSince("ws-1", "conv-1", since)).resolves.toBe(false)
        expect(sent.em.query).toHaveBeenCalledWith(FIND_RECENT_HOLDING, ["ws-1", "conv-1:%", since])
    })

    it("remembers a holding line by conversation and time", async () => {
        const { service, em } = await build([])

        await service.rememberHolding("ws-1", "conv-1", new Date(1_760_000_000_000))

        expect(em.query).toHaveBeenCalledWith(INSERT_HOLDING_RECEIPT, ["ws-1", "conv-1:1760000000000"])
    })
})
