import type { PayableOrder, Plan, WorkspaceBilling } from "@modules/domain/billing"
import type { PaymentOrder } from "@modules/domain/payment-orders"

/** The clock of the credits specs. */
export const NOW = "2026-10-12T10:00:00.000Z"
/** The day the starter plan was paid until. */
export const PAID_UNTIL = "2026-10-27T10:00:00.000Z"
/** The plan a workspace is on in the credits specs. */
export const CURRENT: Plan = {
    code: "starter",
    nameVi: "Khoi dau",
    nameEn: "Starter",
    priceVnd: 990000,
    period: "month",
    seats: 3,
    features: { vi: ["a"], en: ["b"] },
    sort: 1,
    aiCreditsPerMonth: 3000,
    isCustom: false,
    priceAnnualVnd: null,
    annualDiscountPct: null,
    promoPriceVnd: null,
    promoMonths: null,
    storageGb: null,
    individual: false,
    perSeat: false,
    listed: false,
    tiers: [],
    packs: [],
}
/** The listed plan an upgrade moves to. */
export const TARGET: Plan = { ...CURRENT, code: "growth", priceVnd: 1990000, sort: 2, listed: true }
/** An active workspace billing on the starter plan. */
export const WORKSPACE: WorkspaceBilling = {
    status: "active",
    planCode: "starter",
    paidUntil: PAID_UNTIL,
    tierCredits: null,
    seatCount: null,
    billingCycle: null,
    billedMonthlyVnd: null,
}
/** A pending top-up payment order. */
export const ORDER: PaymentOrder = {
    id: "order-1",
    workspaceId: "ws-1",
    planCode: "starter",
    amountVnd: 299000,
    orderCode: "NIVO8F3K2",
    status: "pending",
    expiresAt: "2026-10-12T10:30:00.000Z",
    paidAt: null,
    createdAt: NOW,
    kind: "topup",
    packCode: "credits_1000",
    detail: { credits: 1000 },
}
/** The payable form of the top-up order. */
export const PAYABLE: PayableOrder = {
    order: ORDER,
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=299000&des=NIVO8F3K2&template=compact",
    bank: { account: "0123", bank: "MB", holder: "NIVO" },
}
/** A pending upgrade payment order. */
export const UPGRADE_ORDER: PaymentOrder = {
    ...ORDER,
    planCode: "growth",
    amountVnd: 1495000,
    kind: "upgrade",
    packCode: null,
    detail: {
        from: "starter",
        to: "growth",
        fromPrice: 990000,
        toPrice: 1990000,
        credit: 495000,
        daysLeft: 15,
        paidUntil: PAID_UNTIL,
    },
}
/** The payable form of the upgrade order. */
export const UPGRADE_PAYABLE: PayableOrder = {
    ...PAYABLE,
    order: UPGRADE_ORDER,
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=1495000&des=NIVO8F3K2&template=compact",
}
/** What an upgrade answers: the payable order and its quote. */
export const UPGRADE_RESULT = {
    payable: UPGRADE_PAYABLE,
    quote: { amount: 1495000, credit: 495000, daysLeft: 15, fromCode: "starter" },
}
