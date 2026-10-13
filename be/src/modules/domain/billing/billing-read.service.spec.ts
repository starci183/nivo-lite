import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { BillingReadService } from "./billing-read.service"
import { BillingService } from "./billing.service"

const ORDER: PaymentOrder = {
    id: "order-1",
    workspaceId: "ws-1",
    planCode: "starter",
    amountVnd: 990000,
    orderCode: "NIVO8F3K2",
    status: "pending",
    expiresAt: "2026-10-12T10:30:00.000Z",
    paidAt: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    kind: "plan",
    packCode: null,
    detail: { credits: 3000, cycle: "monthly" },
}
const BANK = { account: "0123", bank: "MB", holder: "NIVO" }
const QR = "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2"
const INSTRUCTIONS = {
    ...ORDER,
    qrUrl: QR,
    bank: BANK,
    detail: {
        credits: 3000,
        from: null,
        to: null,
        fromPrice: null,
        toPrice: null,
        credit: null,
        daysLeft: null,
        paidUntil: null,
        cycle: "monthly",
        tierCredits: null,
        seats: null,
        promo: null,
    },
}

const build = async () => {
    const billing = mock<BillingService>()
    const orders = mock<PaymentOrdersService>()
    billing.payable.mockReturnValue({ order: ORDER, qrUrl: QR, bank: BANK })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BillingReadService,
            { provide: BillingService, useValue: billing },
            { provide: PaymentOrdersService, useValue: orders },
        ],
    }).compile()
    return { read: moduleRef.get(BillingReadService), billing, orders }
}

describe("BillingReadService", () => {
    it("maps a member's orders to payment instructions", async () => {
        const { read, billing, orders } = await build()
        orders.list.mockResolvedValue([ORDER])

        await expect(read.paymentOrders("user-1", "ws-1")).resolves.toEqual([INSTRUCTIONS])

        expect(billing.requireMember).toHaveBeenCalledWith("user-1", "ws-1")
        expect(orders.list).toHaveBeenCalledWith("ws-1")
    })

    it("answers null when the member's order or open plan order is missing", async () => {
        const { read, orders } = await build()
        orders.find.mockResolvedValue(null)
        orders.findOpenPlan.mockResolvedValue(null)

        await expect(read.paymentOrder("user-1", "ws-1", "order-1")).resolves.toBeNull()
        await expect(read.openPlanPaymentOrder("user-1", "ws-1")).resolves.toBeNull()
        expect(orders.find).toHaveBeenCalledWith("ws-1", "order-1")
        expect(orders.findOpenPlan).toHaveBeenCalledWith("ws-1")
    })
})
