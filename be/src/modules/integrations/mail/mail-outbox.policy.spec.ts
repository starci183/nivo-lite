import { linksOf, outboxEntryOf, parseOutboxEntry, selectEntries } from "./mail-outbox.policy"
import type { OutboxEntry } from "./mail-outbox.policy"

const entry = (at: string, to: string): OutboxEntry => ({ at, to, subject: "s", text: "t", links: [] })

describe("mail-outbox policy / linksOf", () => {
    it("lists the web links in order without the punctuation of a sentence", () => {
        const text = "Open https://app.test/auth/confirm?token=abc. Or (http://x.test/a), done"

        expect(linksOf(text)).toEqual(["https://app.test/auth/confirm?token=abc", "http://x.test/a"])
    })
    it("lists nothing for a text without a link", () => {
        expect(linksOf("no link")).toEqual([])
    })
})

describe("mail-outbox policy / outboxEntryOf", () => {
    it("keeps the time, the recipient, the subject, the text and its links", () => {
        expect(outboxEntryOf(new Date("2026-11-04T01:02:03.000Z"), "a@x.test", "Hi", "go https://l.test/1")).toEqual({
            at: "2026-11-04T01:02:03.000Z",
            to: "a@x.test",
            subject: "Hi",
            text: "go https://l.test/1",
            links: ["https://l.test/1"],
        })
    })
})

describe("mail-outbox policy / parseOutboxEntry", () => {
    it("reads a stored entry and drops a link that is no text", () => {
        expect(parseOutboxEntry({ at: "a", to: "b", subject: "c", text: "d", links: ["l", 1] })).toEqual({
            at: "a",
            to: "b",
            subject: "c",
            text: "d",
            links: ["l"],
        })
    })
    it.each([
        null,
        "x",
        { at: "a" },
        { at: "a", to: "b", subject: "c", text: "d" },
        { at: 1, to: "b", subject: "c", text: "d", links: [] },
    ])("refuses %j", (document) => {
        expect(parseOutboxEntry(document)).toBeUndefined()
    })
})

describe("mail-outbox policy / selectEntries", () => {
    const entries = [entry("2026-01-02", "B@x.test"), entry("2026-01-01", "a@x.test"), entry("2026-01-03", "a@x.test")]

    it("lists everything oldest first", () => {
        expect(selectEntries(entries, {}).map((e) => e.at)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"])
    })
    it("filters by recipient without regard to case and keeps the newest on request", () => {
        expect(selectEntries(entries, { to: " A@X.test " }).map((e) => e.at)).toEqual(["2026-01-01", "2026-01-03"])
        expect(selectEntries(entries, { to: "a@x.test", latest: true }).map((e) => e.at)).toEqual(["2026-01-03"])
        expect(selectEntries(entries, { latest: false })).toHaveLength(3)
    })
})
