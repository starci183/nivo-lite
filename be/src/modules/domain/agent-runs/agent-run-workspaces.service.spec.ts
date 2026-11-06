import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspacesService } from "@modules/domain/workspaces"
import { AgentRunWorkspacesService } from "./agent-run-workspaces.service"
import { WORKSPACE_SLICE } from "./policies/agent-runs.policy"

const names = (count: number, from = 0) =>
    Array.from({ length: count }, (_, index) => ({ id: `ws-${String(from + index).padStart(4, "0")}`, name: "n" }))

const build = async () => {
    const workspaces = mock<WorkspacesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRunWorkspacesService, { provide: WorkspacesService, useValue: workspaces }],
    }).compile()
    return { service: moduleRef.get(AgentRunWorkspacesService), workspaces }
}

describe("AgentRunWorkspacesService", () => {
    it("walks the workspaces by slice and starts over after the last short slice", async () => {
        const { service, workspaces } = await build()
        workspaces.list.mockResolvedValueOnce(names(WORKSPACE_SLICE)).mockResolvedValueOnce(names(2, WORKSPACE_SLICE))
        workspaces.list.mockResolvedValueOnce(names(1))

        const first = await service.next()
        const second = await service.next()
        const third = await service.next()

        expect(first).toHaveLength(WORKSPACE_SLICE)
        expect(second).toEqual([
            `ws-${String(WORKSPACE_SLICE).padStart(4, "0")}`,
            `ws-${String(WORKSPACE_SLICE + 1).padStart(4, "0")}`,
        ])
        expect(third).toEqual(["ws-0000"])
        expect(workspaces.list.mock.calls.map((call) => call[1])).toEqual([
            undefined,
            `ws-${String(WORKSPACE_SLICE - 1).padStart(4, "0")}`,
            undefined,
        ])
    })
})
