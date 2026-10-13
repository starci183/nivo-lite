import {
    AUTOMATION_COMMAND_JOB,
    AUTOMATION_QUEUE,
    AUTOMATION_TICK_JOB,
    AUTOMATION_TICK_SCHEDULER,
} from "./automation.queue"

describe("automation queue", () => {
    it("names the minute tick and the command job", () => {
        expect(AUTOMATION_QUEUE).toBe("automation")
        expect(AUTOMATION_TICK_JOB).toBe("automation.tick")
        expect(AUTOMATION_COMMAND_JOB).toBe("automation.command")
        expect(AUTOMATION_TICK_SCHEDULER).toEqual({
            queue: "automation",
            job: "automation.tick",
            id: "automation-tick",
            everyMs: 60_000,
        })
    })
})
