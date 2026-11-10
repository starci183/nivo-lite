import { deadlineKeyOf, scheduleKeyOf, scheduledKeyOf, taskKeyOf } from "./scheduled-items.policy"

const AT = new Date("2026-11-12T02:00:00.000Z")

describe("scheduled item keys", () => {
    it("reads back the key of a task's timer, a clock slot and a stop's deadline (a step key may hold a colon)", () => {
        expect(scheduledKeyOf(taskKeyOf("task-1", AT))).toEqual({ kind: "task", taskId: "task-1", at: AT })
        expect(scheduledKeyOf(scheduleKeyOf("trigger-1", AT))).toEqual({ kind: "schedule", triggerId: "trigger-1", slot: AT })
        expect(scheduledKeyOf(deadlineKeyOf("run-1", "match", 2, 1))).toEqual({
            kind: "deadline",
            runId: "run-1",
            stepKey: "match",
            repeats: 2,
            answered: 1,
        })
        expect(scheduledKeyOf(deadlineKeyOf("run-1", "loop:3", 1, 0))).toMatchObject({ stepKey: "loop:3" })
    })

    it("names a deadline by the deadline job's own identity (the stop as it stood), so a later arming is another key", () => {
        expect(deadlineKeyOf("run-1", "match", 1, 0)).toBe("deadline:run-1:match:1.0")
        expect(deadlineKeyOf("run-1", "match", 1, 1)).not.toBe(deadlineKeyOf("run-1", "match", 1, 0))
        expect(taskKeyOf("task-1", AT)).toBe(`task:task-1:${String(AT.getTime())}`)
    })

    it("refuses a text that is no item key", () => {
        expect(
            ["", "task", "task:t1", "task:t1:x", "schedule::1", "deadline:run-1:1.0", "deadline:run-1:match:x", "other:a:1", "x".repeat(301)].map(
                scheduledKeyOf,
            ),
        ).toEqual([null, null, null, null, null, null, null, null, null])
    })
})
