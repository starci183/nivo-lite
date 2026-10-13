import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { BillingReadService } from "./billing-read.service"
import type { PayableOrder } from "./billing.contracts"
import { BillingService } from "./billing.service"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

const BANK = { account: "0123", bank: "MB", holder: "NIVO" }

const orderOf = builder<PaymentOrder>({
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
    detail: { credits: 3000, cycle: "monthly", tierCredits: 0, promo: "yes" },
})

const DETAIL = {
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
}

const build = async () => {
    const billing = mock<BillingService>({
        requireMember: jest.fn(() => Promise.resolve()),
        payable: jest.fn((order: PaymentOrder): PayableOrder => ({
            order,
            qrUrl: `https://qr/${order.orderCode}`,
            bank: BANK,
        })),
    })
    const orders = mock<PaymentOrdersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BillingReadService,
            { provide: BillingService, useValue: billing },
            { provide: PaymentOrdersService, useValue: orders },
        ],
    }).compile()
    return { reads: moduleRef.get(BillingReadService), billing, orders }
}

describe("BillingReadService", () => {
    describe("paymentOrders", () => {
        it("answers each order of the workspace with its payment instructions", async () => {
            const { reads, billing, orders } = await build()
            orders.list.mockResolvedValue([orderOf()])

            await expect(reads.paymentOrders("user-1", "ws-1")).resolves.toEqual([
                { ...orderOf(), qrUrl: "https://qr/NIVO8F3K2", bank: BANK, detail: DETAIL },
            ])
            expect(billing.requireMember).toHaveBeenCalledWith("user-1", "ws-1")
        })

        it("reads no order for someone who is not a member", async () => {
            const { reads, billing, orders } = await build()
            billing.requireMember.mockRejectedValue(new BillingError({ code: BillingErrorCode.NotMember }))

            await expect(reads.paymentOrders("user-1", "ws-1")).rejects.toMatchObject({
                code: BillingErrorCode.NotMember,
            })
            expect(orders.list).not.toHaveBeenCalled()
        })
    })

    describe("paymentOrder", () => {
        it("answers the order with its instructions, or nothing when it is not in the workspace", async () => {
            const { reads, orders } = await build()
            orders.find.mockResolvedValueOnce(orderOf()).mockResolvedValueOnce(null)

            await expect(reads.paymentOrder("user-1", "ws-1", "order-1")).resolves.toMatchObject({
                id: "order-1",
                qrUrl: "https://qr/NIVO8F3K2",
            })
            await expect(reads.paymentOrder("user-1", "ws-1", "order-9")).resolves.toBeNull()
        })
    })

    describe("openPlanPaymentOrder", () => {
        it("answers the open plan order, or nothing when there is none", async () => {
            const { reads, orders } = await build()
            orders.findOpenPlan.mockResolvedValueOnce(orderOf({ id: "order-2" })).mockResolvedValueOnce(null)

            await expect(reads.openPlanPaymentOrder("user-1", "ws-1")).resolves.toMatchObject({ id: "order-2" })
            await expect(reads.openPlanPaymentOrder("user-1", "ws-1")).resolves.toBeNull()
        })
    })
})
