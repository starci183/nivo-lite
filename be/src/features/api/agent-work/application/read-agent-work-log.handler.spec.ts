import { mock } from "@starci/jest-preset"
import type { AgentBindingsService } from "@modules/domain/agent-connections"
import type { AgentWorkAccessService } from "@modules/domain/agent-work"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkItemsViewsReadService } from "@modules/domain/work-items"
import type { Logger } from "@modules/platform/logging"
import { ReadAgentWorkLogHandler } from "./read-agent-work-log.handler"
import { ReadAgentWorkLogQuery } from "./read-agent-work-log.query"

const queryOf = (): ReadAgentWorkLogQuery =>
    new ReadAgentWorkLogQuery({
        request: { workspaceId: "ws-1", installationId: "inst-1" },
        principal: { id: "user-1" } as never,
    })

describe("ReadAgentWorkLogHandler", () => {
    it("proves the caller manages the workspace, then lists the work of the instance with its grants", async () => {
        const access = mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("owner") })
        const installations = mock<InstallationRecordsService>({
            find: jest.fn().mockResolvedValue({ agentId: "agent-1" }),
        })
        const items = mock<WorkItemsViewsReadService>({ ofInstallation: jest.fn().mockResolvedValue([]) })
        const bindings = mock<AgentBindingsService>({ connectionsOfAgent: jest.fn().mockResolvedValue([]) })
        const handler = new ReadAgentWorkLogHandler(mock<Logger>(), access, installations, items, bindings)

        await expect(handler.execute(queryOf())).resolves.toEqual([])
        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(items.ofInstallation).toHaveBeenCalledWith("ws-1", "inst-1", 100)
        expect(bindings.connectionsOfAgent).toHaveBeenCalledWith("user-1", "ws-1", "agent-1")
    })

    it("answers nothing for an instance the workspace does not hold", async () => {
        const access = mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("owner") })
        const installations = mock<InstallationRecordsService>({ find: jest.fn().mockResolvedValue(null) })
        const items = mock<WorkItemsViewsReadService>({ ofInstallation: jest.fn() })
        const bindings = mock<AgentBindingsService>({ connectionsOfAgent: jest.fn() })
        const handler = new ReadAgentWorkLogHandler(mock<Logger>(), access, installations, items, bindings)

        await expect(handler.execute(queryOf())).resolves.toEqual([])
        expect(items.ofInstallation).not.toHaveBeenCalled()
    })
})
