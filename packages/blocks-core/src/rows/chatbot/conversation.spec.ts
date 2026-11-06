import {
    GROUP_GAP_MS,
    dayKeyOf,
    dayNameOf,
    deliveryOf,
    entriesOf,
    messagesOf,
    sideOf,
    timeLabelOf,
} from "./conversation"
import type { MessageRow } from "./conversation.types"

const ZONE = "UTC"
const NOON = Date.parse("2026-11-04T12:00:00.000Z")
const PATHS = {
    idPath: "id",
    textPath: "text",
    authorPath: "who",
    timePath: "at",
    statusPath: "state",
    sidePath: "side",
    markPath: "mark",
}

const row = (overrides: Partial<MessageRow>): MessageRow => ({
    id: "m",
    author: "An",
    text: "hi",
    side: "incoming",
    atMs: NOON,
    mark: "",
    delivery: null,
    ...overrides,
})

describe("deliveryOf", () => {
    it("draws no mark for no text", () => {
        expect(deliveryOf("")).toBeNull()
    })

    it.each([
        ["queued", "queued"],
        ["sending", "queued"],
        ["pending", "queued"],
        ["sent", "sent"],
        ["Delivered", "sent"],
        ["read", "sent"],
        ["seen", "sent"],
        ["failed", "failed"],
        ["error", "failed"],
    ])("maps %s to %s", (text, state) => {
        expect(deliveryOf(text)).toBe(state)
    })

    it("calls a state it does not know unknown", () => {
        expect(deliveryOf("whatever")).toBe("unknown")
    })
})

describe("sideOf", () => {
    it("keeps a side it knows and makes any other text incoming", () => {
        expect(sideOf("outgoing")).toBe("outgoing")
        expect(sideOf("notice")).toBe("notice")
        expect(sideOf("incoming")).toBe("incoming")
        expect(sideOf("agent")).toBe("incoming")
        expect(sideOf("")).toBe("incoming")
    })
})

describe("messagesOf", () => {
    it("reads one message per record through the paths, oldest first", () => {
        const records = [
            { id: "b", text: "second", who: "Bao", at: "2026-11-04T10:05:00.000Z", side: "outgoing", state: "failed" },
            { id: "a", text: "first", who: "An", at: "2026-11-04T10:00:00.000Z", mark: "AI", state: "sent" },
        ]
        expect(messagesOf(records, PATHS)).toEqual([
            {
                id: "a",
                author: "An",
                text: "first",
                side: "incoming",
                atMs: Date.parse("2026-11-04T10:00:00.000Z"),
                mark: "AI",
                delivery: null,
            },
            {
                id: "b",
                author: "Bao",
                text: "second",
                side: "outgoing",
                atMs: Date.parse("2026-11-04T10:05:00.000Z"),
                mark: "",
                delivery: "failed",
            },
        ])
    })

    it("keeps the order of arrival when a message has no valid time", () => {
        const records = [
            { id: "b", text: "second", at: "2026-11-04T10:05:00.000Z" },
            { id: "a", text: "first", at: "not a time" },
        ]
        const rows = messagesOf(records, PATHS)
        expect(rows?.map((message) => message.id)).toEqual(["b", "a"])
        expect(rows?.[1]?.atMs).toBeNull()
    })

    it("reads only what the paths name and accepts numbers as text", () => {
        expect(messagesOf([{ id: 7, text: 1 }], { idPath: "id", textPath: "text" })).toEqual([
            { id: "7", author: "", text: "1", side: "incoming", atMs: null, mark: "", delivery: null },
        ])
    })

    it("skips a record without a text id", () => {
        expect(
            messagesOf([{ text: "orphan" }, { id: "x", text: "kept" }], PATHS)?.map((message) => message.id),
        ).toEqual(["x"])
    })

    it("is null when no message can be drawn", () => {
        expect(messagesOf([], PATHS)).toBeNull()
        expect(messagesOf([{ text: "orphan" }], PATHS)).toBeNull()
    })
})

describe("dayKeyOf", () => {
    it("is the calendar day in the zone of the viewer", () => {
        const late = Date.parse("2026-11-04T20:30:00.000Z")
        expect(dayKeyOf(late, "UTC")).toBe("2026-11-04")
        expect(dayKeyOf(late, "Asia/Ho_Chi_Minh")).toBe("2026-11-05")
    })

    it("falls back to the zone of the runtime", () => {
        expect(dayKeyOf(NOON, undefined)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
})

describe("entriesOf", () => {
    it("opens each day with a divider and groups messages of one author", () => {
        const rows = [
            row({ id: "1", atMs: NOON }),
            row({ id: "2", atMs: NOON + 60_000 }),
            row({ id: "3", atMs: NOON + 60_000 + GROUP_GAP_MS + 1 }),
            row({ id: "4", atMs: NOON + 86_400_000, author: "An" }),
        ]
        expect(
            entriesOf(rows, ZONE).map((entry) => [entry.id, entry.kind === "message" && entry.isContinuation]),
        ).toEqual([
            ["day-2026-11-04", false],
            ["1", false],
            ["2", true],
            ["3", false],
            ["day-2026-11-05", false],
            ["4", false],
        ])
    })

    it("starts a new group when the author or the side changes", () => {
        const rows = [
            row({ id: "1" }),
            row({ id: "2", author: "Bao" }),
            row({ id: "3", author: "Bao", side: "outgoing" }),
        ]
        expect(
            entriesOf(rows, ZONE).flatMap((entry) => (entry.kind === "message" ? [entry.isContinuation] : [])),
        ).toEqual([false, false, false])
    })

    it("never groups a notice with the messages around it", () => {
        const rows = [row({ id: "1" }), row({ id: "2", side: "notice" }), row({ id: "3" })]
        expect(
            entriesOf(rows, ZONE).flatMap((entry) => (entry.kind === "message" ? [entry.isContinuation] : [])),
        ).toEqual([false, false, false])
    })

    it("groups messages without a time with the one before them and adds no divider for them", () => {
        const rows = [row({ id: "1" }), row({ id: "2", atMs: null }), row({ id: "3", atMs: null })]
        const entries = entriesOf(rows, ZONE)
        expect(entries.map((entry) => entry.kind)).toEqual(["day", "message", "message", "message"])
        expect(entries.flatMap((entry) => (entry.kind === "message" ? [entry.isContinuation] : []))).toEqual([
            false,
            true,
            true,
        ])
    })

    it("draws nothing for no messages", () => {
        expect(entriesOf([], ZONE)).toEqual([])
    })

    it("opens no day for a thread whose messages have no time", () => {
        const entries = entriesOf([row({ id: "1", atMs: null })], ZONE)
        expect(entries).toEqual([
            { kind: "message", id: "1", row: row({ id: "1", atMs: null }), isContinuation: false },
        ])
    })
})

describe("dayNameOf", () => {
    it("names today, yesterday and any other day by its date", () => {
        const today = dayNameOf(NOON, NOON, "en", ZONE)
        expect(today).toEqual({ relative: "today", formatted: "November 4, 2026" })
        expect(dayNameOf(NOON - 86_400_000, NOON, "en", ZONE).relative).toBe("yesterday")
        expect(dayNameOf(NOON - 3 * 86_400_000, NOON, "en", ZONE)).toEqual({
            relative: null,
            formatted: "November 1, 2026",
        })
    })

    it("writes the date in the language of the viewer", () => {
        expect(dayNameOf(NOON, NOON, "vi", ZONE).formatted).toContain("2026")
        expect(dayNameOf(NOON, NOON, "vi", ZONE).formatted).not.toBe(dayNameOf(NOON, NOON, "en", ZONE).formatted)
    })
})

describe("timeLabelOf", () => {
    it("writes the time of day in the zone of the viewer", () => {
        expect(timeLabelOf(Date.parse("2026-11-04T08:05:00.000Z"), "en", ZONE)).toBe("08:05")
        expect(timeLabelOf(Date.parse("2026-11-04T08:05:00.000Z"), "vi", "Asia/Ho_Chi_Minh")).toBe("15:05")
    })

    it("is empty for a message without a time", () => {
        expect(timeLabelOf(null, "en", ZONE)).toBe("")
    })
})
