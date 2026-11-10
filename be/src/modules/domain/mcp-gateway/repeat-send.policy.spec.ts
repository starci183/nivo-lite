import { answeredSince, toldBefore } from "./repeat-send.policy"

const STEP = "run-1:match"
const BEGAN = "2026-11-10T10:00:00.000Z"

const line = (ref: string, sentAt: string | Date, text = "Em đã nhận, đang kiểm tra ạ.") => ({ channelRef: ref, sentAt, text })

describe("toldBefore", () => {
    it("answers the newest line the step itself sent before its present attempt began", () => {
        const rows = [
            line("line:run-1:match:aaaa", "2026-11-10T09:00:00.000Z", "first"),
            line("line:run-1:match:bbbb", new Date("2026-11-10T09:30:00.000Z"), "second"),
        ]

        expect(toldBefore(rows, STEP, BEGAN)).toEqual({ text: "second", at: "2026-11-10T09:30:00.000Z" })
    })

    it("counts the engine's holding line of the same run and step (sent by the AI core at the stop, not by the step's agent)", () => {
        const rows = [line("line:honest-line:run-1:match", "2026-11-10T09:40:00.000Z", "Em đang kiểm tra ạ.")]

        expect(toldBefore(rows, STEP, BEGAN)).toEqual({ text: "Em đang kiểm tra ạ.", at: "2026-11-10T09:40:00.000Z" })
        expect(toldBefore([line("line:honest-line:run-1:consult", "2026-11-10T09:40:00.000Z")], STEP, BEGAN)).toBeNull()
        expect(toldBefore([line("line:honest-line:run-2:match", "2026-11-10T09:40:00.000Z")], STEP, BEGAN)).toBeNull()
    })

    it("does not count a line of the present attempt, so a step may say several things in one attempt", () => {
        expect(toldBefore([line("line:run-1:match:aaaa", "2026-11-10T10:00:05.000Z")], STEP, BEGAN)).toBeNull()
        expect(toldBefore([line("line:run-1:match:aaaa", BEGAN)], STEP, BEGAN)).toBeNull()
    })

    it("does not count a line of another step or run, of a person, with no words, or with no time", () => {
        const rows = [
            line("line:run-1:consult:aaaa", "2026-11-10T09:00:00.000Z"),
            line("line:run-2:match:aaaa", "2026-11-10T09:00:00.000Z"),
            line("line:run-1:matcher:aaaa", "2026-11-10T09:00:00.000Z"),
            { channelRef: null, sentAt: "2026-11-10T09:00:00.000Z", text: "a person" },
            line("line:run-1:match:cccc", "2026-11-10T09:00:00.000Z", ""),
            line("line:run-1:match:dddd", "not a time"),
        ]

        expect(toldBefore(rows, STEP, BEGAN)).toBeNull()
        expect(toldBefore([line("line:run-1:match:aaaa", "2026-11-10T09:00:00.000Z")], STEP, "never")).toBeNull()
    })
})

describe("answeredSince", () => {
    const told = { text: "x", at: "2026-11-10T09:30:00.000Z" }

    it("is true only for a founder's answer newer than the line", () => {
        expect(answeredSince([{ at: "2026-11-10T09:45:00.000Z" }], told)).toBe(true)
        expect(answeredSince([{ at: "2026-11-10T09:00:00.000Z" }], told)).toBe(false)
        expect(answeredSince([{ at: told.at }], told)).toBe(false)
        expect(answeredSince([{ at: "2026-11-10T09:00:00.000Z" }, { at: "2026-11-10T09:50:00.000Z" }], told)).toBe(true)
    })

    it("is false with no answer at all (a retry with no words, a timer, a re-drive) or an answer with no time", () => {
        expect(answeredSince(undefined, told)).toBe(false)
        expect(answeredSince([], told)).toBe(false)
        expect(answeredSince([{ at: "?" }], told)).toBe(false)
    })
})
