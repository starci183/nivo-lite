import { Test } from "@nestjs/testing"
import type { ParkedFlowAlert } from "@modules/platform/jobs"
import { EntityEngineErrorCode } from "./errors/entity-engine.error"
import { ReadOnlyEngineAlertsService } from "./read-only-engine-alerts.service"

const alert: ParkedFlowAlert = {
    kind: "flow-parked",
    jobId: "job-1",
    flowKind: "chatbot.deliver-reply",
    failureClass: "code",
    reason: "boom",
    correlationId: "c-1",
    build: "b-1",
    action: "resume",
}

describe("ReadOnlyEngineAlertsService", () => {
    it("refuses an alert, because a process that only reads records runs no job", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [ReadOnlyEngineAlertsService] }).compile()
        await expect(moduleRef.get(ReadOnlyEngineAlertsService).raise(alert)).rejects.toMatchObject({
            code: EntityEngineErrorCode.Unavailable,
        })
    })
})
