import { TASK_WAKE_MAX_MS } from "./agent-work.policy"
import {
    TIMER_MAX_MINUTES,
    timerDueAtOf,
    timerDueInBounds,
    timerEventKeyOf,
    timerTaskKeyOf,
    timerTaskOf,
    timerTaskTitleOf,
    timerWakeAtOf,
} from "./timer-task.policy"

const NOW = new Date("2026-11-13T03:00:00.000Z")
const MINUTE = 60_000

describe("the key of a timer's task", () => {
    it("is one per subject and ref: the contact first, else the conversation, else none", () => {
        expect(timerTaskKeyOf({ contactId: "c-1", conversationId: "v-1" }, "pay-check")).toBe("timer:contact:c-1:pay-check")
        expect(timerTaskKeyOf({ contactId: null, conversationId: "v-1" }, "pay-check")).toBe("timer:conversation:v-1:pay-check")
        expect(timerTaskKeyOf({ contactId: null, conversationId: null }, "pay-check")).toBe("timer:none:-:pay-check")
    })

    it("keeps another subject's or another ref's timer separate, and the same ref of one subject the same", () => {
        const one = timerTaskKeyOf({ contactId: "c-1", conversationId: null }, "a")
        expect(timerTaskKeyOf({ contactId: "c-1", conversationId: "other-conversation" }, "a")).toBe(one)
        expect(timerTaskKeyOf({ contactId: "c-2", conversationId: null }, "a")).not.toBe(one)
        expect(timerTaskKeyOf({ contactId: "c-1", conversationId: null }, "b")).not.toBe(one)
    })

    it("reads back the ref, the subject, the due instant and the data, a ref with the separator included", () => {
        const key = timerTaskKeyOf({ contactId: "c-1", conversationId: null }, "order:DH001:remind")
        const title = timerTaskTitleOf("2026-12-01T00:00:00.000Z")
        expect(timerTaskOf(key, title, { tries: 2 })).toEqual({
            ref: "order:DH001:remind",
            subject: { contactId: "c-1", conversationId: null },
            dueAt: "2026-12-01T00:00:00.000Z",
            data: { tries: 2 },
        })
        expect(timerTaskOf(key, title, null)).not.toHaveProperty("data")
        expect(timerTaskOf(timerTaskKeyOf({ contactId: null, conversationId: "v-9" }, "x"), title)?.subject).toEqual({
            contactId: null,
            conversationId: "v-9",
        })
        expect(timerTaskOf(timerTaskKeyOf({ contactId: null, conversationId: null }, "x"), title)?.subject).toEqual({
            contactId: null,
            conversationId: null,
        })
    })

    it("answers null for a task that is no timer (a care step, another key, a title without a moment)", () => {
        expect(timerTaskOf("care:payment-reminder:o1", "care due 2026-12-01T00:00:00.000Z")).toBeNull()
        expect(timerTaskOf("timer:contact:c-1:a", "care due 2026-12-01T00:00:00.000Z")).toBeNull()
        expect(timerTaskOf("timer:contact:c-1:a", "timer due soon")).toBeNull()
        expect(timerTaskOf("timer:alien:c-1:a", "timer due 2026-12-01T00:00:00.000Z")).toBeNull()
        expect(timerTaskOf("timer:contact:c-1", "timer due 2026-12-01T00:00:00.000Z")).toBeNull()
    })
})

describe("the conversation of a timer's task", () => {
    const key = timerTaskKeyOf({ contactId: "c-1", conversationId: "v-1" }, "r1")

    it("is kept in the title beside the due instant, so a task keyed by its contact still names its conversation", () => {
        const title = timerTaskTitleOf("2026-12-01T00:00:00.000Z", "v-1")
        expect(timerTaskOf(key, title)).toEqual({
            ref: "r1",
            subject: { contactId: "c-1", conversationId: "v-1" },
            dueAt: "2026-12-01T00:00:00.000Z",
        })
    })

    it("leaves the title as before when there is no conversation, and reads a title that has none as none", () => {
        expect(timerTaskTitleOf("2026-12-01T00:00:00.000Z", null)).toBe("timer due 2026-12-01T00:00:00.000Z")
        expect(timerTaskTitleOf("2026-12-01T00:00:00.000Z")).toBe("timer due 2026-12-01T00:00:00.000Z")
        expect(timerTaskOf(key, "timer due 2026-12-01T00:00:00.000Z")?.subject).toEqual({ contactId: "c-1", conversationId: null })
    })

    it("a task keyed by its conversation names the same conversation", () => {
        const byConversation = timerTaskKeyOf({ contactId: null, conversationId: "v-9" }, "r1")
        expect(timerTaskOf(byConversation, timerTaskTitleOf("2026-12-01T00:00:00.000Z", "v-9"))?.subject).toEqual({
            contactId: null,
            conversationId: "v-9",
        })
    })
})

describe("the moment of a timer", () => {
    it("is the instant given, or the minutes after the engine's clock, or none", () => {
        expect(timerDueAtOf({ dueAt: "2026-11-14T03:00:00.000Z" }, NOW)).toEqual(new Date("2026-11-14T03:00:00.000Z"))
        expect(timerDueAtOf({ dueAt: "2026-11-14T10:00:00+07:00" }, NOW)).toEqual(new Date("2026-11-14T03:00:00.000Z"))
        expect(timerDueAtOf({ afterMinutes: 90 }, NOW)).toEqual(new Date(NOW.getTime() + 90 * MINUTE))
        expect(timerDueAtOf({}, NOW)).toBeNull()
        expect(timerDueAtOf({ dueAt: "not a date" }, NOW)).toBeNull()
    })

    it("is in bounds from one minute to 365 days ahead, inclusive", () => {
        expect(timerDueInBounds(new Date(NOW.getTime() + 59_999), NOW)).toBe(false)
        expect(timerDueInBounds(new Date(NOW.getTime() + MINUTE), NOW)).toBe(true)
        expect(timerDueInBounds(new Date(NOW.getTime() + TIMER_MAX_MINUTES * MINUTE), NOW)).toBe(true)
        expect(timerDueInBounds(new Date(NOW.getTime() + TIMER_MAX_MINUTES * MINUTE + 1), NOW)).toBe(false)
        expect(timerDueInBounds(new Date(NOW.getTime() - MINUTE), NOW)).toBe(false)
    })

    it("wakes the task at the due instant, or seven days ahead when it is farther", () => {
        const near = new Date(NOW.getTime() + 3 * MINUTE)
        expect(timerWakeAtOf(near, NOW)).toEqual(near)
        expect(timerWakeAtOf(new Date(NOW.getTime() + 200 * 86_400_000), NOW)).toEqual(new Date(NOW.getTime() + TASK_WAKE_MAX_MS))
    })

    it("keys the wake by the task and the due instant", () => {
        expect(timerEventKeyOf("task-1", new Date("2026-12-01T00:00:00.000Z"))).toBe("timer:task-1:1796083200000")
        expect(timerEventKeyOf("task-1", new Date("2026-12-02T00:00:00.000Z"))).not.toBe(timerEventKeyOf("task-1", new Date("2026-12-01T00:00:00.000Z")))
    })
})
