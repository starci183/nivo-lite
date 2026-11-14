import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { AgentWorkLogService } from "./agent-work-log.service"

const build = async (installation: { readonly agentId: string | null } | null) => {
    const access = mock<AgentWorkAccessService>({ managedInstallation: jest.fn().mockResolvedValue(installation) })
    const items = mock<WorkItemsViewsReadService>({ ofInstallation: jest.fn().mockResolvedValue([]) })
    const bindings = mock<AgentBindingsService>({ connectionsOfAgent: jest.fn().mockResolvedValue([]) })
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkLogService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkItemsViewsReadService, useValue: items },
            { provide: AgentBindingsService, useValue: bindings },
        ],
    }).compile()
    return { service: container.get(AgentWorkLogService), access, items, bindings }
}

describe("AgentWorkLogService.lines", () => {
    it("proves the caller manages the workspace, then lists the work of the instance with its grants", async () => {
        const { service, access, items, bindings } = await build({ agentId: "agent-1" })

        await expect(service.lines("user-1", "ws-1", "inst-1")).resolves.toEqual([])
        expect(access.managedInstallation).toHaveBeenCalledWith("user-1", "ws-1", "inst-1")
        expect(items.ofInstallation).toHaveBeenCalledWith("ws-1", "inst-1", 100)
        expect(bindings.connectionsOfAgent).toHaveBeenCalledWith("user-1", "ws-1", "agent-1")
    })

    it("lists the work of an instance that drives no agent without reading any grant", async () => {
        const { service, items, bindings } = await build({ agentId: null })

        await expect(service.lines("user-1", "ws-1", "inst-1")).resolves.toEqual([])
        expect(items.ofInstallation).toHaveBeenCalledWith("ws-1", "inst-1", 100)
        expect(bindings.connectionsOfAgent).not.toHaveBeenCalled()
    })

    it("answers nothing for an instance the workspace does not hold", async () => {
        const { service, items } = await build(null)

        await expect(service.lines("user-1", "ws-1", "inst-1")).resolves.toEqual([])
        expect(items.ofInstallation).not.toHaveBeenCalled()
    })
})
