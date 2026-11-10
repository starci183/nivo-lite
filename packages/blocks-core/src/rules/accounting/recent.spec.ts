import { TRANSACTION, transactionOf } from "./accounting.fixtures"
import { connectionOf, recentRowsOf, timeOf } from "./recent"
import type { BankConnection, RecentWords } from "./recent"

const WORDS: RecentWords = {
    matched: (amount) => `${amount} matched`,
    unmatched: (amount) => `${amount} open`,
    otherIncome: (amount) => `${amount} other`,
}

const NOW = new Date("2026-11-04T11:30:00.000Z")

const MB: BankConnection = { provider: "sepay", name: "MB 9999", accountMasked: "****9999", access: "auto" }
const VCB: BankConnection = { provider: "casso", name: "VCB 1234", accountMasked: "****1234", access: "ask" }

describe("the time of a payment", () => {
    it("is the time of day on the day of now, on the shop wall", () => {
        expect(timeOf("2026-11-04T07:32:00.000Z", NOW)).toBe("14:32")
    })

    it("is the day and month on another day", () => {
        expect(timeOf("2026-11-02T07:32:00.000Z", NOW)).toBe("02/11")
    })
})

describe("the connection of a payment", () => {
    it("is the one whose account ends like the account of the payment", () => {
        expect(connectionOf("0011229999", [VCB, MB])).toBe(MB)
    })

    it("is the only connection when the account matches none", () => {
        expect(connectionOf("5555", [VCB])).toBe(VCB)
        expect(connectionOf(null, [VCB])).toBe(VCB)
    })

    it("is none when there are several and no match, or none at all", () => {
        expect(connectionOf("5555", [VCB, MB])).toBeNull()
        expect(connectionOf(null, [])).toBeNull()
    })
})

describe("the rows of recent work", () => {
    const row = (status: "matched" | "unmatched" | "other_income" | "needs_review") => ({
        payment: transactionOf({ id: `${status}-id`, status, occurredAt: "2026-11-04T07:32:00.000Z" }),
        account: "9999",
    })

    it("name the connection, its logo and the level the agent holds on it", () => {
        const [first] = recentRowsOf([{ payment: TRANSACTION, account: "1234" }], [MB, VCB], WORDS, NOW)
        expect(first).toMatchObject({
            id: TRANSACTION.id,
            connection: "VCB 1234",
            logo: "/logos/providers/casso.svg",
            level: "ask",
            status: "waiting",
        })
        expect(first?.title).toContain("5.000.000")
    })

    it("tell a matched payment, one the owner set aside and one that waits apart", () => {
        const rows = recentRowsOf([row("matched"), row("other_income"), row("needs_review")], [MB], WORDS, NOW)
        expect(rows.map((one) => [one.status, one.title.split(" ").pop()])).toEqual([
            ["done", "matched"],
            ["done", "other"],
            ["waiting", "open"],
        ])
    })

    it("leave the connection empty when none is known", () => {
        const [first] = recentRowsOf([row("matched")], [], WORDS, NOW)
        expect(first).toMatchObject({ connection: "", logo: "", level: "" })
    })
})
