import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { FlowAlerts, ParkedFlowAlert } from "@modules/platform/jobs"
import { AgentRunAlertsService } from "./agent-run-alerts.service"

const ALERT: ParkedFlowAlert = {
    kind: "flow-parked",
    jobId: "run-1",
    flowKind: "agent-run",
    failureClass: "code",
    reason: "invalid_step_input",
    correlationId: "wake-1",
    build: "b2",
    action: "resume",
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentRunAlertsService] }).compile()
    return moduleRef.get(AgentRunAlertsService)
}

describe("AgentRunAlertsService", () => {
    it("raises nothing while no capability registered its alerts", async () => {
        await expect((await build()).raise(ALERT)).resolves.toBeUndefined()
    })

    it("tells every registered alert, in the order they registered", async () => {
        const alerts = await build()
        const told: Array<string> = []
        const first = mock<FlowAlerts>({
            raise: jest.fn(() => Promise.resolve(told.push("first")).then(() => undefined)),
        })
        const second = mock<FlowAlerts>({
            raise: jest.fn(() => Promise.resolve(told.push("second")).then(() => undefined)),
        })
        alerts.add(first)
        alerts.add(second)

        await alerts.raise(ALERT)

        expect(told).toEqual(["first", "second"])
        expect(second.raise).toHaveBeenCalledWith(ALERT)
    })

    it("stops at an alert that throws, so the caller keeps the run untold and tries again", async () => {
        const alerts = await build()
        const later = mock<FlowAlerts>({ raise: jest.fn().mockResolvedValue(undefined) })
        alerts.add(mock<FlowAlerts>({ raise: jest.fn().mockRejectedValue(new Error("work engine down")) }))
        alerts.add(later)

        await expect(alerts.raise(ALERT)).rejects.toThrow("work engine down")
        expect(later.raise).not.toHaveBeenCalled()
    })
})
