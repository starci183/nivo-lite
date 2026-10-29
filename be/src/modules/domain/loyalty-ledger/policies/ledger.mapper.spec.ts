import { toEntry, toExpiryEntry, toMember, toTotal } from "./ledger.mapper"
import type { LoyaltyCustomer } from "@modules/domain/loyalty-customers"
import type { BalanceRaw, EntryFields, ExpiryFields, TotalRaw } from "./ledger.mapper"

const customer: LoyaltyCustomer = {
    id: "c-1",
    name: "Nguyen Van A",
    phone: "84901234567",
    email: "a@example.com",
    birthday: "1990-10-03",
    tierKey: "gold",
    joinedAt: "2025-01-02T03:04:05.000Z",
    note: "regular",
}

const balanceRow = (overrides: Partial<BalanceRaw> = {}): BalanceRaw => ({
    customer_id: "c-1",
    points: 120,
    lifetime_spend_vnd: 5_000_000,
    visits: 7,
    last_visit_at: new Date("2025-06-07T08:09:10.000Z"),
    ...overrides,
})

const entryRow = (overrides: Partial<EntryFields> = {}): EntryFields => ({
    id: "e-1",
    customerId: "c-1",
    kind: "earn",
    points: 50,
    amountVnd: 500_000,
    orderId: "o-1",
    ref: "ref-1",
    byName: "Lan",
    evidence: "receipt",
    rewardId: "r-1",
    workItemId: "w-1",
    expiresAt: new Date("2026-01-02T03:04:05.000Z"),
    occurredAt: new Date("2025-01-02T03:04:05.000Z"),
    ...overrides,
})

describe("toMember", () => {
    it("maps the customer columns and the balances", () => {
        expect(toMember(customer, balanceRow())).toEqual({
            id: "c-1",
            name: "Nguyen Van A",
            phone: "84901234567",
            email: "a@example.com",
            birthday: "1990-10-03",
            tierKey: "gold",
            points: 120,
            lifetimeSpendVnd: 5_000_000,
            visits: 7,
            lastVisitAt: "2025-06-07T08:09:10.000Z",
            joinedAt: "2025-01-02T03:04:05.000Z",
            note: "regular",
        })
    })

    it("answers a null last visit for a member who never earned", () => {
        expect(toMember(customer, balanceRow({ last_visit_at: null })).lastVisitAt).toBeNull()
    })

    it("holds nothing for a customer the ledger has no entry for", () => {
        expect(toMember(customer, undefined)).toMatchObject({
            points: 0,
            lifetimeSpendVnd: 0,
            visits: 0,
            lastVisitAt: null,
        })
    })
})

describe("toEntry", () => {
    it("maps every column and writes the dates as ISO text", () => {
        expect(toEntry(entryRow())).toEqual({
            id: "e-1",
            customerId: "c-1",
            kind: "earn",
            points: 50,
            amountVnd: 500_000,
            orderId: "o-1",
            ref: "ref-1",
            by: "Lan",
            evidence: "receipt",
            rewardId: "r-1",
            workItemId: "w-1",
            expiresAt: "2026-01-02T03:04:05.000Z",
            occurredAt: "2025-01-02T03:04:05.000Z",
        })
    })

    it("answers a null expiry for an entry that never expires", () => {
        expect(toEntry(entryRow({ expiresAt: null })).expiresAt).toBeNull()
    })
})

describe("toExpiryEntry", () => {
    const expiryRow = (expiresAt: Date | null): ExpiryFields => ({ kind: "earn", points: 30, expiresAt })

    it("writes the expiry as ISO text", () => {
        expect(toExpiryEntry(expiryRow(new Date("2026-01-02T03:04:05.000Z")))).toEqual({
            kind: "earn",
            points: 30,
            expiresAt: "2026-01-02T03:04:05.000Z",
        })
    })

    it("keeps an absent expiry as null", () => {
        expect(toExpiryEntry(expiryRow(null))).toEqual({ kind: "earn", points: 30, expiresAt: null })
    })
})

describe("toTotal", () => {
    it("maps the grouped columns", () => {
        const row: TotalRaw = { kind: "redeem", entries: 3, points: -90, amount_vnd: 0 }

        expect(toTotal(row)).toEqual({ kind: "redeem", entries: 3, points: -90, amountVnd: 0 })
    })
})
