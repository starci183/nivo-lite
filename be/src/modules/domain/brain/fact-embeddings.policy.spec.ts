import { Test } from "@nestjs/testing"
import { embeddingFactOf } from "@tests/fixtures/builders/brain-embeddings.builder"
import { periodsMeet, samePeriod, sameTruthActOf } from "./fact-embeddings.policy"

const SUBJECT = Symbol("fact-embeddings.policy")
type Subject = typeof import("./fact-embeddings.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { periodsMeet, samePeriod, sameTruthActOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** A standing value: no stated end (a truth in force carries the one-year default, which is no stated period). */
const STANDING = { validFrom: null, validTo: null }
const IN_FORCE = { validFrom: "2026-11-13T00:00:00.000Z", validTo: "2027-11-13T00:00:00.000Z" }
/** A dated window: three days of February. */
const WINDOW = { validFrom: "2027-02-11T17:00:00.000Z", validTo: "2027-02-14T17:00:00.000Z" }
/** A window that overlaps it by one day. */
const OVERLAPPING = { validFrom: "2027-02-13T17:00:00.000Z", validTo: "2027-02-16T17:00:00.000Z" }
/** A window after it. */
const LATER = { validFrom: "2027-03-01T17:00:00.000Z", validTo: "2027-03-05T17:00:00.000Z" }

const fee = (value: string, dates: Pick<ReturnType<typeof embeddingFactOf>, "validFrom" | "validTo">, id = "fee") =>
    embeddingFactOf({ id, value, unit: null, ...dates })

describe("fact-embeddings.policy: what a same-truth verdict means once values and periods are read (Round W, D-W-2 / O2c)", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it.each([
        ["two standing values", STANDING, IN_FORCE, true],
        ["two windows that overlap", WINDOW, OVERLAPPING, true],
        ["the same window twice", WINDOW, WINDOW, true],
        ["two windows that never overlap", WINDOW, LATER, false],
        ["a window filed after the standing value", WINDOW, IN_FORCE, false],
        ["a standing value filed after the window", STANDING, WINDOW, false],
    ])("says whether %s hold at the same time", (_case, one, other, meet) => {
        expect(subject.periodsMeet(one, other)).toBe(meet)
        expect(subject.periodsMeet(other, one)).toBe(meet)
    })

    it.each([
        ["two standing values", STANDING, IN_FORCE, true],
        ["the same window twice", WINDOW, { ...WINDOW }, true],
        ["two windows that only overlap", WINDOW, OVERLAPPING, false],
        ["a window and a standing value", WINDOW, STANDING, false],
    ])("says whether %s hold for exactly the same time", (_case, one, other, same) => {
        expect(subject.samePeriod(one, other)).toBe(same)
    })

    it("joins the same value for the same time: two standing values, or the same window in two documents", () => {
        expect(subject.sameTruthActOf(fee("30.000", STANDING), fee("30k", IN_FORCE, "known"), true, false)).toBe("join")
        expect(subject.sameTruthActOf(fee("30.000", WINDOW), fee("30k", WINDOW, "scheduled"), true, false)).toBe("join")
    })

    it("asks when they hold at the same time with another value, and when the judge's answer stayed unreadable", () => {
        expect(subject.sameTruthActOf(fee("45.000", STANDING), fee("30.000", IN_FORCE, "known"), true, false)).toBe("ask")
        expect(subject.sameTruthActOf(fee("50.000", WINDOW), fee("30.000", OVERLAPPING, "known"), true, false)).toBe("ask")
        expect(subject.sameTruthActOf(fee("30.000", STANDING), fee("30.000", IN_FORCE, "known"), false, false)).toBe("ask")
    })

    it("links a window filed over the standing value as it always was (the settle reads the link as the window's overlay)", () => {
        expect(subject.sameTruthActOf(fee("50.000", WINDOW), fee("30.000", IN_FORCE, "known"), true, false)).toBe("ask")
        expect(subject.sameTruthActOf(fee("50.000", WINDOW), fee("30.000", IN_FORCE, "known"), false, false)).toBe("ask")
        expect(subject.sameTruthActOf(fee("30k", WINDOW), fee("30.000", IN_FORCE, "known"), true, false)).toBe("join")
    })

    it("keeps apart a standing value filed after a dated window, whatever the judge said: they never hold at the same time", () => {
        expect(subject.sameTruthActOf(fee("30.000", STANDING), fee("50.000", WINDOW, "scheduled"), true, false)).toBe("apart")
        expect(subject.sameTruthActOf(fee("30.000", STANDING), fee("50.000", WINDOW, "scheduled"), false, false)).toBe("apart")
    })

    it("keeps apart two windows that never overlap, and the same value over windows that only overlap", () => {
        expect(subject.sameTruthActOf(fee("50.000", WINDOW), fee("60.000", LATER, "known"), true, false)).toBe("apart")
        expect(subject.sameTruthActOf(fee("50.000", WINDOW), fee("50.000", OVERLAPPING, "known"), true, false)).toBe("apart")
    })

    it("takes the judge's reading of the values only where code cannot compare them", () => {
        const address = fee("57 Vo Van Ngan", STANDING)
        const written = fee("so 57 duong Vo Van Ngan", IN_FORCE, "known")

        expect(subject.sameTruthActOf(address, written, true, true)).toBe("join")
        expect(subject.sameTruthActOf(address, written, true, false)).toBe("ask")
    })
})
