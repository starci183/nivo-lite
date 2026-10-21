import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { HubCardPayload } from "./accounting-desk.contracts"
import { AccountingDecisionsService } from "./accounting-decisions.service"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, OptionalReceivable, PaymentCredit } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { RECEIVABLE_COPY, receivableMatchText } from "./messages/accounting-desk.messages"
import { ReceivableReconcileService } from "./receivable-reconcile.service"

const WS = "ws-1"
const FIND_TOOL = "billing.receivables.find"
const CREDITS_TOOL = "bank.transactions.list"

const credit = (overrides: Partial<PaymentCredit> = {}): PaymentCredit => ({
    creditRef: "SP-9",
    reference: " CK PAY F7K2Q9 ",
    amountVnd: 12_800_000,
    occurredAt: "2026-10-20T01:00:00Z",
    matched: false,
    ...overrides,
})

const build = async (receivable: OptionalReceivable, recorded = true) => {
    const gateway = mock<AccountingGateway>({
        findReceivable: jest.fn(() => Promise.resolve({ tool: FIND_TOOL, value: receivable })),
        recordPayment: jest.fn(() => Promise.resolve(recorded)),
    })
    const room = mock<AccountingRoomService>({
        post: jest.fn(() => Promise.resolve()),
        postCard: jest.fn((_workspaceId: string, card: HubCardPayload) => Promise.resolve(card)),
    })
    const decisions = mock<AccountingDecisionsService>({
        askPayment: jest.fn(() => Promise.resolve({ kind: "work_item" as const, id: "wi-9" })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReceivableReconcileService,
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: AccountingRoomService, useValue: room },
            { provide: AccountingDecisionsService, useValue: decisions },
        ],
    }).compile()
    return { service: moduleRef.get(ReceivableReconcileService), gateway, room, decisions }
}

describe("ReceivableReconcileService", () => {
    it("records an exact payment of the receivable the memo names and reports it", async () => {
        const { service, gateway, room } = await build({ receivableId: "rc-1", balanceVnd: 12_800_000 })

        await expect(service.reconcile(WS, credit(), CREDITS_TOOL)).resolves.toEqual({
            kind: "recorded",
            tool: FIND_TOOL,
        })

        expect(gateway.findReceivable).toHaveBeenCalledWith(WS, "CK PAY F7K2Q9")
        expect(gateway.recordPayment).toHaveBeenCalledWith(WS, {
            receivableId: "rc-1",
            creditRef: "SP-9",
            amountVnd: 12_800_000,
        })
        expect(room.post).toHaveBeenCalledWith(WS, RECEIVABLE_COPY.recorded("CK PAY F7K2Q9", 12_800_000, "SP-9"))
    })

    it("reports a payment the connector did not record", async () => {
        const { service, room } = await build({ receivableId: "rc-1", balanceVnd: 12_800_000 }, false)

        await expect(service.reconcile(WS, credit(), CREDITS_TOOL)).resolves.toEqual({
            kind: "record_failed",
            tool: FIND_TOOL,
        })

        expect(room.post).toHaveBeenCalledWith(WS, RECEIVABLE_COPY.failed("CK PAY F7K2Q9", "SP-9"))
    })

    it("opens a different amount as a decision for the chief accountant, citing the tools that answered, and records nothing", async () => {
        const { service, gateway, room, decisions } = await build({ receivableId: "rc-1", balanceVnd: 20_000_000 })

        await expect(service.reconcile(WS, credit(), CREDITS_TOOL)).resolves.toEqual({
            kind: "mismatch",
            match: "partial",
            tool: FIND_TOOL,
        })

        expect(gateway.recordPayment).not.toHaveBeenCalled()
        expect(decisions.askPayment).toHaveBeenCalledWith(WS, {
            receivable: { receivableId: "rc-1", balanceVnd: 20_000_000 },
            credit: credit(),
            summary: RECEIVABLE_COPY.text("CK PAY F7K2Q9", 12_800_000, 20_000_000),
        })
        const [, card, text] = room.postCard.mock.calls[0] ?? []
        expect(card).toEqual(
            expect.objectContaining({
                type: "exception",
                title: RECEIVABLE_COPY.title("CK PAY F7K2Q9"),
                badge: receivableMatchText("partial"),
                data: { receivableId: "rc-1", creditRef: "SP-9" },
                ref: { kind: "work_item", id: "wi-9" },
                actions: ["approve", "decline"],
            }),
        )
        expect(card?.sources?.map((source) => source.ref)).toEqual([CREDITS_TOOL, FIND_TOOL])
        expect(text).toBe(RECEIVABLE_COPY.text("CK PAY F7K2Q9", 12_800_000, 20_000_000))
    })

    it("leaves a credit without a memo, or whose memo names no receivable, as it is", async () => {
        const { service, gateway, room } = await build(null)

        await expect(service.reconcile(WS, credit({ reference: "  " }), CREDITS_TOOL)).resolves.toEqual({
            kind: "no_reference",
            tool: null,
        })
        expect(gateway.findReceivable).not.toHaveBeenCalled()
        await expect(service.reconcile(WS, credit(), CREDITS_TOOL)).resolves.toEqual({
            kind: "unknown",
            tool: FIND_TOOL,
        })
        expect(room.post).not.toHaveBeenCalled()
        expect(room.postCard).not.toHaveBeenCalled()
    })
})
