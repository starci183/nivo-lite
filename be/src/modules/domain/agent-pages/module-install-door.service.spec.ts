import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentWorkflowInstallService } from "@modules/domain/agent-graphs"
import { ModuleInstallService, type InstallRequest, type InstallResult } from "@modules/domain/modules"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ModuleInstallDoorService } from "./module-install-door.service"

const REQUEST = builder<InstallRequest>({
    workspaceId: "ws-1",
    moduleKey: "sales",
    locale: "vi",
    newInstance: false,
    name: null,
})()

const build = async (made: Partial<InstallResult>, withWorkflows = true) => {
    const installs = mock<ModuleInstallService>()
    installs.install.mockResolvedValue({ agentId: null, installationId: "inst-1", created: true, ...made })
    const workflows = mock<AgentWorkflowInstallService>()
    const log = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            ModuleInstallDoorService,
            { provide: LOGGER, useValue: log },
            { provide: ModuleInstallService, useValue: installs },
            ...(withWorkflows ? [{ provide: AgentWorkflowInstallService, useValue: workflows }] : []),
        ],
    }).compile()
    return { service: container.get(ModuleInstallDoorService), installs, workflows, log }
}

describe("ModuleInstallDoorService.install", () => {
    it("installs as the member and makes the workflows of the agent it made", async () => {
        const { service, installs, workflows } = await build({ agentId: "agent-1" })

        const answer = await service.install("user-1", REQUEST)

        expect(answer.installationId).toBe("inst-1")
        expect(installs.install).toHaveBeenCalledWith("user-1", REQUEST)
        expect(workflows.install).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            installationId: "inst-1",
            moduleKey: "sales",
        })
    })

    it("makes no workflows for an install that made no agent", async () => {
        const { service, workflows } = await build({ agentId: null })

        await service.install("user-1", REQUEST)

        expect(workflows.install).not.toHaveBeenCalled()
    })

    it("still answers the installation, and logs, when its workflows could not be made", async () => {
        const { service, workflows, log } = await build({ agentId: "agent-1" })
        const cause = new Error("no graph")
        workflows.install.mockRejectedValue(cause)

        await expect(service.install("user-1", REQUEST)).resolves.toMatchObject({ installationId: "inst-1" })
        expect(log.error).toHaveBeenCalledWith("modules.install.workflows_failed", cause, {
            workspaceId: "ws-1",
            installationId: "inst-1",
        })
    })

    it("installs without workflows in an app that has no workflow install service", async () => {
        const { service } = await build({ agentId: "agent-1" }, false)

        await expect(service.install("user-1", REQUEST)).resolves.toMatchObject({ installationId: "inst-1" })
    })
})
