import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { DEFAULT_CONFIG } from "./rules/config"
import {
    campaignOf,
    decisionOf,
    expiryEntryOf,
    ledgerRowOf,
    memberOf,
    programOfRecord,
    rewardOf,
} from "./loyalty-records"

const record = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "r1",
    workspaceId: "w1",
    version: "3",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    data,
})

const MEMBER = {
    name: "Lan",
    note: "",
    points: 10,
    lifetimeSpendVnd: 1000,
    visits: 1,
    joinedAt: "2026-01-01T00:00:00.000Z",
}

describe("memberOf", () => {
    it("reads a customer and writes what the record left out as null", () => {
        expect(memberOf(record(MEMBER))).toEqual({
            id: "r1",
            version: "3",
            ...MEMBER,
            phone: null,
            email: null,
            birthday: null,
            tierKey: null,
            lastVisitAt: null,
        })
        expect(memberOf(record({ ...MEMBER, phone: "84900000001", tierKey: "dong" }))).toMatchObject({
            phone: "84900000001",
            tierKey: "dong",
        })
    })

    it("reads nothing from a record that is not a customer", () => {
        expect(memberOf(record({ name: 3 }))).toBeNull()
    })
})

const ENTRY = { kind: "earn", points: 5, by: "NIVO", occurredAt: "2026-02-01T00:00:00.000Z" }

describe("ledgerRowOf and expiryEntryOf", () => {
    it("read a ledger entry and the part of it that decides what is unspent", () => {
        expect(ledgerRowOf(record(ENTRY))).toEqual({
            id: "r1",
            ...ENTRY,
            amountVnd: null,
            evidence: null,
            expiresAt: null,
        })
        expect(expiryEntryOf(record({ ...ENTRY, expiresAt: "2027-01-01T00:00:00.000Z" }))).toEqual({
            kind: "earn",
            points: 5,
            expiresAt: "2027-01-01T00:00:00.000Z",
        })
    })

    it("read nothing from a record that is no entry", () => {
        expect(ledgerRowOf(record({ kind: "gift" }))).toBeNull()
        expect(expiryEntryOf(record({}))).toBeNull()
    })
})

describe("rewardOf", () => {
    const REWARD = {
        key: "k",
        name: "Reward",
        kind: "voucher",
        valueVnd: 10,
        pointsCost: 5,
        note: "",
        active: true,
    }

    it("reads a reward", () => {
        expect(rewardOf(record(REWARD))).toMatchObject({
            id: "r1",
            version: "3",
            key: "k",
            percent: null,
            stock: null,
            perCustomerLimit: null,
            minTierKey: null,
        })
    })

    it("reads nothing from a record that is no reward", () => {
        expect(rewardOf(record({ key: 1 }))).toBeNull()
    })
})

describe("programOfRecord", () => {
    it("reads the programme with its rules resolved over the defaults", () => {
        expect(programOfRecord(record({ name: "P", slug: "p", enabled: true, config: DEFAULT_CONFIG }))).toMatchObject({
            name: "P",
            slug: "p",
            enabled: true,
            version: "3",
            config: { tiers: [{ key: "dong" }, { key: "bac" }, { key: "vang" }] },
        })
    })

    it("reads nothing from a record that is no programme, or whose rules are not rules", () => {
        expect(programOfRecord(record({ name: 1 }))).toBeNull()
        expect(programOfRecord(record({ name: "P", slug: "p", enabled: true, config: {} }))).toBeNull()
    })
})

describe("campaignOf", () => {
    it("reads a promotion with the time it was made", () => {
        expect(
            campaignOf(
                record({
                    name: "C",
                    segment: { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 },
                    draft: "",
                    status: "draft",
                    recipients: 0,
                    sent: 0,
                    failed: 0,
                    createdBy: "NIVO",
                }),
            ),
        ).toMatchObject({ id: "r1", workItemId: null, createdAt: "2026-11-01T00:00:00.000Z" })
    })

    it("reads nothing from a record that is no promotion", () => {
        expect(campaignOf(record({ segment: 1 }))).toBeNull()
    })
})

describe("decisionOf", () => {
    it("reads a decision with the time it was raised", () => {
        expect(decisionOf(record({ action: "send_promo", summary: "s", draft: "", customer: "" }))).toEqual({
            id: "r1",
            action: "send_promo",
            summary: "s",
            draft: "",
            reason: null,
            amountVnd: null,
            customer: "",
            createdAt: "2026-11-01T00:00:00.000Z",
        })
    })

    it("reads nothing from a record that is no decision", () => {
        expect(decisionOf(record({ action: 1 }))).toBeNull()
    })
})
