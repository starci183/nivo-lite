import { DEFAULT_CONFIG } from "../../../rules/loyalty/config"
import type { CampaignRow, DecisionItem, LedgerRow, MemberRow, ProgramRow, RewardRow } from "../loyalty.types"

/** The instant the sample data is drawn at: noon in Vietnam, 5 November 2026. */
export const SAMPLE_NOW = "2026-11-05T05:00:00.000Z"

/** A ledger entry of the sample: what the timeline shows, with the customer, the key and the reward behind it. */
export interface StoredEntry extends LedgerRow {
    /** The customer whose points moved. */
    readonly customerId: string
    /** The idempotency key of the entry. */
    readonly ref: string
    /** The reward behind a redeem, or null. */
    readonly rewardId: string | null
}

const DAY = 86_400_000
const ago = (days: number): string => new Date(Date.parse(SAMPLE_NOW) - days * DAY).toISOString()

/** The programme of the sample shop: the starter rules, switched on. */
export const SAMPLE_PROGRAM: ProgramRow = {
    name: "Hoa Mai Coffee",
    slug: "hoa-mai-coffee",
    enabled: true,
    config: DEFAULT_CONFIG,
    version: "1",
}

/** The gold regular of the sample shop, who the detail and the forms start from. */
export const MEMBER_GOLD: MemberRow = {
    id: "m-1",
    version: "1",
    name: "Nguy\u1ec5n Th\u1ecb Lan",
    phone: "84912345678",
    email: "lan@example.com",
    birthday: "1990-11-20",
    tierKey: "vang",
    points: 1450,
    lifetimeSpendVnd: 12_400_000,
    visits: 31,
    lastVisitAt: ago(3),
    joinedAt: ago(400),
    note: "Prefers oat milk",
}

/** The sample customers: a gold regular, a silver one who is going quiet, a new one, a customer who never bought, a bronze one. */
export const SAMPLE_MEMBERS: ReadonlyArray<MemberRow> = [
    MEMBER_GOLD,
    {
        id: "m-2",
        version: "1",
        name: "Tr\u1ea7n Qu\u1ed1c D\u0169ng",
        phone: "84987654321",
        email: null,
        birthday: null,
        tierKey: "bac",
        points: 620,
        lifetimeSpendVnd: 4_100_000,
        visits: 12,
        lastVisitAt: ago(75),
        joinedAt: ago(300),
        note: "",
    },
    {
        id: "m-3",
        version: "1",
        name: "L\u00ea Minh Ch\u00e2u",
        phone: "84901112233",
        email: "chau@example.com",
        birthday: "1995-03-02",
        tierKey: "dong",
        points: 180,
        lifetimeSpendVnd: 950_000,
        visits: 4,
        lastVisitAt: ago(12),
        joinedAt: ago(60),
        note: "",
    },
    {
        id: "m-4",
        version: "1",
        name: "Ph\u1ea1m Thu H\u00e0",
        phone: null,
        email: "ha@example.com",
        birthday: null,
        tierKey: null,
        points: 0,
        lifetimeSpendVnd: 0,
        visits: 0,
        lastVisitAt: null,
        joinedAt: ago(8),
        note: "",
    },
    {
        id: "m-5",
        version: "1",
        name: "V\u00f5 Ho\u00e0ng Nam",
        phone: "84933445566",
        email: null,
        birthday: null,
        tierKey: "dong",
        points: 40,
        lifetimeSpendVnd: 210_000,
        visits: 1,
        lastVisitAt: ago(140),
        joinedAt: ago(200),
        note: "",
    },
]

/** The sample ledger: what moved the points of the first customer, newest last. */
export const SAMPLE_ENTRIES: ReadonlyArray<StoredEntry> = [
    {
        id: "e-1",
        customerId: "m-1",
        kind: "earn",
        points: 320,
        amountVnd: 320_000,
        evidence: "1/1k",
        by: "NIVO",
        expiresAt: "2027-09-20T03:00:00.000Z",
        occurredAt: ago(46),
        ref: "sale-1",
        rewardId: null,
    },
    {
        id: "e-2",
        customerId: "m-1",
        kind: "redeem",
        points: -500,
        amountVnd: 50_000,
        evidence: "50,000 VND voucher QT-0000R1",
        by: "staff-1",
        expiresAt: null,
        occurredAt: ago(20),
        ref: "redeem:r1",
        rewardId: "r-1",
    },
    {
        id: "e-3",
        customerId: "m-1",
        kind: "earn",
        points: 1800,
        amountVnd: 1_200_000,
        evidence: "1.5/1k x 1.5 V\u00e0ng",
        by: "NIVO",
        expiresAt: ago(-330),
        occurredAt: ago(3),
        ref: "sale-2",
        rewardId: null,
    },
    {
        id: "e-4",
        customerId: "m-1",
        kind: "adjust",
        points: -170,
        amountVnd: null,
        evidence: "Refund of a returned order",
        by: "staff-1",
        expiresAt: null,
        occurredAt: ago(2),
        ref: "adjust:a1",
        rewardId: null,
    },
]

/** The voucher of the sample catalogue, which the reward form starts from. */
export const REWARD_VOUCHER: RewardRow = {
    id: "r-1",
    version: "1",
    key: "voucher-50k",
    name: "50,000 VND voucher",
    kind: "voucher",
    valueVnd: 50_000,
    percent: null,
    pointsCost: 500,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
    note: "50,000 VND off the next order",
    active: true,
}

/** The sample reward catalogue: a voucher, a percent reward limited to two per customer, and a gift for silver members. */
export const SAMPLE_REWARDS: ReadonlyArray<RewardRow> = [
    REWARD_VOUCHER,
    {
        id: "r-2",
        version: "1",
        key: "giam-10",
        name: "10% off",
        kind: "percent",
        valueVnd: 100_000,
        percent: 10,
        pointsCost: 800,
        stock: null,
        perCustomerLimit: 2,
        minTierKey: null,
        note: "",
        active: true,
    },
    {
        id: "r-3",
        version: "1",
        key: "qua-tang",
        name: "Shop gift",
        kind: "item",
        valueVnd: 150_000,
        percent: null,
        pointsCost: 1200,
        stock: 0,
        perCustomerLimit: 1,
        minTierKey: "bac",
        note: "Out of stock until the next delivery",
        active: false,
    },
]

/** The sample promotions: one drafted and waiting for the owner, one sent. */
export const SAMPLE_CAMPAIGNS: ReadonlyArray<CampaignRow> = [
    {
        id: "c-1",
        name: "Th\u00e0nh vi\u00ean h\u1ea1ng B\u1ea1c l\u00e2u ch\u01b0a quay l\u1ea1i",
        segment: { tiers: ["bac"], inactiveDays: 60, birthdayThisMonth: false, minSpendVnd: 0 },
        draft: "Hi {ten_khach}, we miss you at {ten_shop}. Come back this week for a free topping.",
        status: "waiting_decision",
        workItemId: "d-1",
        recipients: 1,
        sent: 0,
        failed: 0,
        createdBy: "Owner",
        createdAt: ago(1),
    },
    {
        id: "c-2",
        name: "November birthdays",
        segment: { tiers: [], inactiveDays: 0, birthdayThisMonth: true, minSpendVnd: 0 },
        draft: "Happy birthday {ten_khach}! {diem} points are waiting for you.",
        status: "done",
        workItemId: null,
        recipients: 1,
        sent: 1,
        failed: 0,
        createdBy: "Owner",
        createdAt: ago(9),
    },
]

/** The sample decisions: the drafted promotion and a manual adjustment the agent proposes. */
export const SAMPLE_DECISIONS: ReadonlyArray<DecisionItem> = [
    {
        id: "d-1",
        action: "send_promo",
        summary:
            "G\u1eedi khuy\u1ebfn m\u00e3i cho th\u00e0nh vi\u00ean h\u1ea1ng B\u1ea1c l\u00e2u ch\u01b0a quay l\u1ea1i",
        draft: "Hi {ten_khach}, we miss you at {ten_shop}. Come back this week for a free topping.",
        reason: "Bulk promotions always wait for the owner",
        amountVnd: null,
        createdAt: ago(1),
        customer: "1 member",
    },
    {
        id: "d-2",
        action: "adjust_points",
        summary: "C\u1ed9ng 200 \u0111i\u1ec3m cho l\u1ea7n mua ch\u01b0a \u0111\u01b0\u1ee3c t\u00edch",
        draft: "",
        reason: null,
        amountVnd: null,
        createdAt: new Date(Date.parse(SAMPLE_NOW) - 5 * 3_600_000).toISOString(),
        customer: "Nguy\u1ec5n Th\u1ecb Lan",
    },
]
