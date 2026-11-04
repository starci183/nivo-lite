import { Test } from "@nestjs/testing"
import {
    POLL_BACKFILL_MS,
    POLL_CURSOR_KEY,
    POLL_OVERLAP_MS,
    cursorOf,
    laterOf,
    metaWithCursor,
    olderPageEnd,
    windowStartOf,
} from "./connection-poll.policy"

const SUBJECT = Symbol("connection-poll.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cursorOf, windowStartOf, laterOf, olderPageEnd, metaWithCursor } }],
    }).compile()
    return moduleRef.get<typeof import("./connection-poll.policy")>(SUBJECT)
}

const NOW = new Date("2026-11-04T10:00:00.000Z")
const T1 = new Date("2026-11-04T01:06:00.000Z")
const T2 = new Date("2026-11-03T18:00:00.000Z")

const page = (fetched: number, oldestAt: Date | undefined) => ({
    kind: "page" as const,
    items: [],
    fetched,
    oldestAt,
    newestAt: undefined,
})

describe("cursorOf", () => {
    it.each([
        ["no fact", {}, undefined],
        ["an unreadable fact", { [POLL_CURSOR_KEY]: "later" }, undefined],
        ["a fact", { [POLL_CURSOR_KEY]: T1.toISOString() }, T1],
    ])("reads %s", async (_name, meta, expected) => {
        const subject = await build()
        expect(subject.cursorOf(meta)).toEqual(expected)
    })
})

describe("windowStartOf", () => {
    it("reads the backfill window on the first run", async () => {
        const subject = await build()
        expect(subject.windowStartOf(undefined, NOW)).toEqual(new Date(NOW.getTime() - POLL_BACKFILL_MS))
    })

    it("starts a little before the cursor, so a late booked transaction is still found", async () => {
        const subject = await build()
        expect(subject.windowStartOf(T1, NOW)).toEqual(new Date(T1.getTime() - POLL_OVERLAP_MS))
    })

    it("never reaches back further than the backfill window", async () => {
        const subject = await build()
        const stale = new Date(NOW.getTime() - 30 * 86_400_000)
        expect(subject.windowStartOf(stale, NOW)).toEqual(new Date(NOW.getTime() - POLL_BACKFILL_MS))
    })
})

describe("laterOf", () => {
    it.each([
        [undefined, undefined, undefined],
        [T1, undefined, T1],
        [undefined, T2, T2],
        [T1, T2, T1],
        [T2, T1, T1],
    ])("picks the later of %s and %s", async (left, right, expected) => {
        const subject = await build()
        expect(subject.laterOf(left, right)).toEqual(expected)
    })
})

describe("olderPageEnd", () => {
    it("is done on a page that is not full or empty", async () => {
        const subject = await build()
        expect(subject.olderPageEnd(page(3, T1), 200, undefined)).toBeUndefined()
        expect(subject.olderPageEnd(page(200, undefined), 200, undefined)).toBeUndefined()
    })

    it("asks for the page that ends where a full page ended", async () => {
        const subject = await build()
        expect(subject.olderPageEnd(page(200, T1), 200, undefined)).toEqual(T1)
        expect(subject.olderPageEnd(page(200, T2), 200, T1)).toEqual(T2)
    })

    it("stops when a full page did not reach further back than it was asked", async () => {
        const subject = await build()
        expect(subject.olderPageEnd(page(200, T1), 200, T1)).toBeUndefined()
    })
})

describe("metaWithCursor", () => {
    it("keeps the other facts and sets the cursor", async () => {
        const subject = await build()
        expect(subject.metaWithCursor({ bank_code: "VCB" }, T1)).toEqual({
            bank_code: "VCB",
            [POLL_CURSOR_KEY]: T1.toISOString(),
        })
    })
})
