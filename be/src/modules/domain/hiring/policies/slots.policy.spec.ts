import { computeSlots, DEFAULT_WINDOWS } from "./slots.policy"

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

    it("offers the first free time of three different Vietnam days by default", () => {
        expect(computeSlots(DEFAULT_WINDOWS, [], 30, new Date("2026-10-12T00:00:00.000Z"))).toEqual([
            { start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" },
            { start: "2026-10-13T02:00:00.000Z", end: "2026-10-13T02:30:00.000Z" },
            { start: "2026-10-14T02:00:00.000Z", end: "2026-10-14T02:30:00.000Z" },
        ])
    })

    it("accepts the exact two-hour lead boundary and excludes earlier starts", () => {
        expect(
            computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 780 }],
                [],
                60,
                new Date("2026-10-12T02:00:00.000Z"),
                1,
                0,
            ),
        ).toEqual([{ start: "2026-10-12T04:00:00.000Z", end: "2026-10-12T05:00:00.000Z" }])
    })

    it("allows busy intervals that touch either end without overlapping", () => {
        expect(
            computeSlots(
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

    it("excludes every slot that overlaps any part of a busy interval", () => {
        expect(
            computeSlots(
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

    it("spreads later rounds within a day, stops after three rounds, and sorts by start", () => {
        expect(
            computeSlots(
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

    it("never repeats a single slot in later rounds or for duplicated windows", () => {
        expect(
            computeSlots(
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

    it("uses the Vietnam day when UTC is still the preceding Sunday", () => {
        expect(
            computeSlots(
                [{ weekday: 1, startMin: 540, endMin: 570 }],
                [],
                30,
                new Date("2026-10-11T18:00:00.000Z"),
                1,
                0,
            ),
        ).toEqual([{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" }])
    })

    it("returns no slots when no days are available or no slots are requested", () => {
        const now = new Date("2026-10-12T00:00:00.000Z")

        expect(computeSlots([], [], 30, now)).toEqual([])
        expect(computeSlots([{ weekday: 2, startMin: 540, endMin: 570 }], [], 30, now, 3, 0)).toEqual([])
        expect(computeSlots([{ weekday: 1, startMin: 540, endMin: 570 }], [], 60, now, 3, 0)).toEqual([])
        expect(computeSlots(DEFAULT_WINDOWS, [], 30, now, 0)).toEqual([])
        expect(
            computeSlots(
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
