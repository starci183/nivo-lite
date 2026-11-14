import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { frozenFreezeOf, pendingLineOf, pendingPaymentOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"

const FREEZE = frozenFreezeOf({ episode: 2 })

const EVENT = pendingLineOf({ context: { conversationId: "c-1", messageId: "m-2", lookupName: false, locale: "vi" } })

const build = async () => {
    const wakes = mock<DeliveredWakesService>({ rewrite: jest.fn().mockResolvedValue("wake-new") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeWakesService,
            { provide: DeliveredWakesService, useValue: wakes },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeWakesService), wakes }
}

describe("LeadFreezeWakesService", () => {
    it("writes the held events again as wakes of the same agents, in order, each under its key marked with the freeze", async () => {
        const { service, wakes } = await build()
        const tx = mockEntityManager()
        const payment = pendingPaymentOf({ actorMemberId: "member-1" })
        wakes.rewrite.mockResolvedValueOnce("w-1").mockResolvedValueOnce(null)

        await expect(service.replay(tx, "ws-1", FREEZE, [EVENT, payment])).resolves.toBe(1)

        expect(wakes.rewrite.mock.calls).toEqual([
            [
                tx,
                {
                    workspaceId: "ws-1",
                    agentId: "chatbot",
                    source: "trigger",
                    eventKey: "msg-2~after-freeze-freeze-1-2",
                    context: { conversationId: "c-1", messageId: "m-2", lookupName: false, locale: "vi" },
                    actorMemberId: null,
                    scopeKey: "conversation:c-1",
                },
            ],
            [
                tx,
                {
                    workspaceId: "ws-1",
                    agentId: "accounting",
                    source: "tag",
                    eventKey: "bank-feed:conn-1:e-1~after-freeze-freeze-1-2",
                    context: { subject: "bank-transaction:tx-1", tagSource: "bank_feed" },
                    actorMemberId: "member-1",
                },
            ],
        ])
    })

    // FX4 (D-P11-7): the held original stayed `held` after its replay (dev: 7 -> 8 held wakes); a bulk release would answer it twice.
    it("closes each held original in the same transaction, pointing at its replay; an event already replayed closes nothing", async () => {
        const { service, wakes } = await build()
        const tx = mockEntityManager()
        const payment = pendingPaymentOf()
        wakes.rewrite.mockResolvedValueOnce("w-1").mockResolvedValueOnce(null)

        await service.replay(tx, "ws-1", FREEZE, [EVENT, payment])

        expect(wakes.superseded.mock.calls).toEqual([[tx, "ws-1", "wake-2", "w-1"]])
    })

    it("drops a kept member no wake context holds, as a flag where a text belongs or an unknown language", async () => {
        const { service, wakes } = await build()
        const odd = pendingLineOf({ context: { conversationId: "c-1", locale: "fr", text: true, lookupName: true } })

        await service.replay(mockEntityManager(), "ws-1", FREEZE, [odd])

        expect(wakes.rewrite.mock.calls[0]?.[1].context).toEqual({ conversationId: "c-1", lookupName: true })
    })
})
