import { Test } from "@nestjs/testing"
import { ModuleOpsErrorCode } from "./errors/module-ops.error"
import { UnavailableApprovalGateService } from "./unavailable-approval-gate.service"

describe("UnavailableApprovalGateService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnavailableApprovalGateService] }).compile()
        return moduleRef.get(UnavailableApprovalGateService)
    }

    it("refuses to ask for a decision", async () => {
        const gate = await build()

        await expect(gate.request()).rejects.toMatchObject({ code: ModuleOpsErrorCode.GateUnavailable })
    })

    it("refuses to record a decision", async () => {
        const gate = await build()

        await expect(gate.decide()).rejects.toMatchObject({ code: ModuleOpsErrorCode.GateUnavailable })
    })
})
