import { Test } from "@nestjs/testing"
import { computeSlots as computeSlotsImplementation, DEFAULT_WINDOWS } from "./slots.policy"

const SUBJECT = Symbol("subject")
type Subject = { computeSlots: typeof computeSlotsImplementation }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { computeSlots: computeSlotsImplementation } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("interview slots policy", () => {
    it("defines Monday through Friday windows from nine to five", () => {
        expect(DEFAULT_WINDOWS).toEqual([
            { weekday: 1, startMin: 540, endMin: 1020 },
            { weekday: 2, startMin: 540, endMin: 1020 },
            { weekday: 3, startMin: 540, endMin: 1020 },
            { weekday: 4, startMin: 540, endMin: 1020 },
            { weekday: 5, startMin: 540, endMin: 1020 },
        ])
    })

    it("offers the first free time of three different Vietnam days by default", async () => {
        const subject = await buildSubject()
        expect(subject.computeSlots(DEFAULT_WINDOWS, [], 30, new Date("2026-10-12T00:00:00.000Z"))).toEqual([
            { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" },
            { start: "2026-10-13T02:00:00.000Z", end: "2026-10-13T02:30:00.000Z" },
            { start: "2026-10-14T02:00:00.000Z", end: "2026-10-14T02:30:00.000Z" },
        ])
    })

    it("accepts the exact two-hour lead boundary and excludes earlier starts", async () => {
        const subject = await buildSubject()
        expect(
            subject.computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 780 }],
                [],
                60,
                new Date("2026-10-12T02:00:00.000Z"),
                1,
                0,
            ),
        ).toEqual([{ start: "2026-10-12T04:00:00.000Z", end: "2026-10-12T05:00:00.000Z" }])
    })

    it("allows busy intervals that touch either end without overlapping", async () => {
        const subject = await buildSubject()
        expect(
            subject.computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 720 }],
                [
                    { start: "2026-10-12T01:30:00.000Z", end: "2026-10-12T02:00:00.000Z" },
                    { start: "2026-10-12T02:30:00.000Z", end: "2026-10-12T03:00:00.000Z" },
                ],
                30,
                new Date("2026-10-12T00:00:00.000Z"),
                3,
                0,
            ),
        ).toEqual([
            { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" },
            { start: "2026-10-12T03:00:00.000Z", end: "2026-10-12T03:30:00.000Z" },
            { start: "2026-10-12T03:30:00.000Z", end: "2026-10-12T04:00:00.000Z" },
        ])
    })

    it("excludes every slot that overlaps any part of a busy interval", async () => {
        const subject = await buildSubject()
        expect(
            subject.computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 660 }],
                [{ start: "2026-10-12T02:45:00.000Z", end: "2026-10-12T03:15:00.000Z" }],
                30,
                new Date("2026-10-12T00:00:00.000Z"),
                10,
                0,
            ),
        ).toEqual([
            { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" },
            { start: "2026-10-12T03:30:00.000Z", end: "2026-10-12T04:00:00.000Z" },
        ])
    })
})

describe("interview slots policy", () => {
    it("spreads later rounds within a day, stops after three rounds, and sorts by start", async () => {
        const subject = await buildSubject()
        expect(
            subject.computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 720 }],
                [],
                60,
                new Date("2026-10-12T00:00:00.000Z"),
                10,
                0,
            ),
        ).toEqual([
            { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T03:00:00.000Z" },
            { start: "2026-10-12T02:30:00.000Z", end: "2026-10-12T03:30:00.000Z" },
            { start: "2026-10-12T03:00:00.000Z", end: "2026-10-12T04:00:00.000Z" },
        ])
    })

    it("never repeats a single slot in later rounds or for duplicated windows", async () => {
        const subject = await buildSubject()
        expect(
            subject.computeSlots(
                [
                    { weekday: 1, startMin: 540, endMin: 570 },
                    { weekday: 1, startMin: 540, endMin: 570 },
                    { weekday: 2, startMin: 540, endMin: 570 },
                ],
                [],
                30,
                new Date("2026-10-12T00:00:00.000Z"),
                10,
                1,
            ),
        ).toEqual([
            { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" },
            { start: "2026-10-13T02:00:00.000Z", end: "2026-10-13T02:30:00.000Z" },
        ])
    })

    it("uses the Vietnam day when UTC is still the preceding Sunday", async () => {
        const subject = await buildSubject()
        expect(
            subject.computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 570 }],
                [],
                30,
                new Date("2026-10-11T18:00:00.000Z"),
                1,
                0,
            ),
        ).toEqual([{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" }])
    })
})

describe("interview slots policy", () => {
    it("returns no slots when no days are available or no slots are requested", async () => {
        const subject = await buildSubject()
        const now = new Date("2026-10-12T00:00:00.000Z")

        expect(subject.computeSlots([], [], 30, now)).toEqual([])
        expect(subject.computeSlots([{ weekday: 2, startMin: 540, endMin: 570 }], [], 30, now, 3, 0)).toEqual([])
        expect(subject.computeSlots([{ weekday: 1, startMin: 540, endMin: 570 }], [], 60, now, 3, 0)).toEqual([])
        expect(subject.computeSlots(DEFAULT_WINDOWS, [], 30, now, 0)).toEqual([])
        expect(
            subject.computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 570 }],
                [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T03:00:00.000Z" }],
                30,
                now,
                3,
                0,
            ),
        ).toEqual([])
    })
})
