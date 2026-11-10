import type { RunStopAnswer } from "@nivo-lite/blocks-core/entities"
import {
    APPROVAL_DEADLINE_MS,
    OWNER_DEADLINE_MS,
    deadlineAtOf,
    deadlineWindowOf,
    templateWaitMsOf,
} from "./thread-deadline.policy"

const answer = (kind: RunStopAnswer["kind"]): RunStopAnswer => ({ kind, text: null, by: "member-1", at: "2026-11-10T10:00:00.000Z" })

describe("deadlineWindowOf", () => {
    it("gives an approval 24 hours and a stop for the founder 3 days", () => {
        expect(deadlineWindowOf({ kind: "approval", answers: [] }, undefined)).toBe(APPROVAL_DEADLINE_MS)
        expect(APPROVAL_DEADLINE_MS).toBe(86_400_000)
        expect(deadlineWindowOf({ kind: "ai_report", answers: [] }, undefined)).toBe(OWNER_DEADLINE_MS)
        expect(deadlineWindowOf({ kind: "ai_error", answers: [answer("retry")] }, undefined)).toBe(259_200_000)
    })

    it("takes the template's wait of the step before the kind's window, and the app's windows before the defaults", () => {
        expect(deadlineWindowOf({ kind: "approval", answers: [] }, "2h")).toBe(7_200_000)
        expect(deadlineWindowOf({ kind: "ai_report", answers: [] }, "nonsense", { ownerMs: 1000 })).toBe(1000)
        expect(deadlineWindowOf({ kind: "approval", answers: [] }, undefined, { approvalMs: 5000 })).toBe(5000)
    })

    it("sets no deadline on an engine stop, nor on a stop a deadline already answered (one timeout per stop)", () => {
        expect(deadlineWindowOf({ kind: "engine", answers: [] }, "2h")).toBeNull()
        expect(deadlineWindowOf({ kind: "approval", answers: [answer("timeout")] }, undefined)).toBeNull()
    })
})

describe("templateWaitMsOf", () => {
    it.each([
        ["30m", 1_800_000],
        ["2h", 7_200_000],
        [" 3d ", 259_200_000],
    ])("reads %j", (text, ms) => {
        expect(templateWaitMsOf(text)).toBe(ms)
    })

    it.each([undefined, "", "0h", "2w", "90s", "21d"])("reads no wait from %j", (text) => {
        expect(templateWaitMsOf(text)).toBeNull()
    })
})

describe("deadlineAtOf", () => {
    it("counts the window from the moment the stop last stopped", () => {
        expect(deadlineAtOf({ stoppedAt: "2026-11-10T10:00:00.000Z" }, 60_000).toISOString()).toBe("2026-11-10T10:01:00.000Z")
    })
})
