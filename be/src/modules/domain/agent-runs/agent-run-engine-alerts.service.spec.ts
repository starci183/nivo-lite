import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ParkedFlowAlert } from "@modules/platform/jobs"
import { AgentRunAlertsService } from "./agent-run-alerts.service"
import { AgentRunEngineAlertsService } from "./agent-run-engine-alerts.service"

const ALERT: ParkedFlowAlert = {
    kind: "flow-parked",
    jobId: "job-1",
    flowKind: "module-job",
    failureClass: "code",
    reason: "boom",
    correlationId: "job-1",
    build: "build-1",
    action: "resume",
}

describe("AgentRunEngineAlertsService", () => {
    it("hands the alert of a parked engine job to the alerts of the agent runs", async () => {
        const alerts = mock<AgentRunAlertsService>()
        alerts.raise.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [AgentRunEngineAlertsService, { provide: AgentRunAlertsService, useValue: alerts }],
        }).compile()

        await expect(moduleRef.get(AgentRunEngineAlertsService).raise(ALERT)).resolves.toBeUndefined()

        expect(alerts.raise).toHaveBeenCalledWith(ALERT)
    })
})
