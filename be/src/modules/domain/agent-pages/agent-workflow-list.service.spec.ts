import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkflowListService } from "./agent-workflow-list.service"
import { AgentWorkflowRunsService, AgentWorkflowsAdminService, type WorkflowWire } from "@modules/domain/agent-graphs"

const build = async (withRuns: boolean) => {
    const admin = mock<AgentWorkflowsAdminService>({
        list: jest.fn().mockResolvedValue([mock<WorkflowWire>({ id: "w1" }), mock<WorkflowWire>({ id: "w2" })]),
    })
    const runs = mock<AgentWorkflowRunsService>({
        readinessOf: jest.fn().mockResolvedValue(new Map([["w1", { hidden: false, skipped: ["book"] }]])),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkflowListService,
            { provide: AgentWorkflowsAdminService, useValue: admin },
            ...(withRuns ? [{ provide: AgentWorkflowRunsService, useValue: runs }] : []),
        ],
    }).compile()
    return { service: container.get(AgentWorkflowListService), admin, runs }
}

describe("AgentWorkflowListService.list", () => {
    it("asks the admin service as the member, then reads the readiness of the workflows it answered, null for one not read", async () => {
        const { service, admin, runs } = await build(true)

        const listed = await service.list("user-1", "ws-1", "inst-1", "en")

        expect(admin.list).toHaveBeenCalledWith(
            { workspaceId: "ws-1", principalId: "user-1" },
            { installationId: "inst-1", locale: "en" },
        )
        expect(runs.readinessOf).toHaveBeenCalledWith("ws-1", ["w1", "w2"])
        expect(listed.map((one) => [one.id, one.readiness?.skipped ?? null])).toEqual([
            ["w1", ["book"]],
            ["w2", null],
        ])
    })

    it("answers every readiness null in an app that reads none", async () => {
        const { service } = await build(false)

        const listed = await service.list("user-1", "ws-1", "inst-1", undefined)

        expect(listed.map((one) => one.readiness)).toEqual([null, null])
    })
})
