import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AgentGraphLayoutService } from "./agent-graph-layout.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowInstallService } from "./agent-workflow-install.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowsAdminService } from "./agent-workflows-admin.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const MADE = { workspaceId: "ws-1", agentId: "agent-1", installationId: "inst-1", moduleKey: "accounting" }

/** The workflows door of an agent whose seat is `role`, on doubles of everything it reads. */
const build = async (role: "owner" | "manager" | "staff" = "manager") => {
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(mock<MemberSeatRecord>({ memberId: "member-1", role }))
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(mock<InstallationRecord>({ agentId: "agent-1", moduleKey: "accounting" }))
    const workflows = mock<AgentWorkflowsService>()
    workflows.list.mockResolvedValue([])
    workflows.graphOf.mockResolvedValue({ agentId: "agent-1", workflows: [] })
    const agents = mock<AgentDirectoryService>()
    agents.identitiesOf.mockResolvedValue([])
    const installer = mock<AgentWorkflowInstallService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentWorkflowsAdminService,
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentWorkflowsService, useValue: workflows },
            { provide: AgentWorkflowRunsService, useValue: mock<AgentWorkflowRunsService>() },
            { provide: AgentGraphLayoutService, useValue: mock<AgentGraphLayoutService>() },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: AgentWorkflowInstallService, useValue: installer },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { admin: moduleRef.get(AgentWorkflowsAdminService), workflows, installer, logger }
}

describe("AgentWorkflowsAdminService: opening an agent's workflows gives it the ones its plugin ships", () => {
    it("makes them before the list and before the graph page are read: an agent installed before the doors made them is repaired here", async () => {
        const { admin, workflows, installer } = await build()

        await admin.list(ACTOR, { installationId: "inst-1" })
        await admin.graph(ACTOR, { installationId: "inst-1" })

        expect(installer.install.mock.calls).toEqual([[MADE], [MADE]])
        const [first, second] = installer.install.mock.invocationCallOrder
        expect(workflows.list.mock.invocationCallOrder[0]).toBeGreaterThan(first ?? 0)
        expect(workflows.graphOf.mock.invocationCallOrder[0]).toBeGreaterThan(second ?? 0)
    })

    it("answers the page when they cannot be made, and logs the failure", async () => {
        const { admin, installer, logger } = await build()
        const failure = new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        installer.install.mockRejectedValue(failure)

        await expect(admin.list(ACTOR, { installationId: "inst-1" })).resolves.toEqual([])

        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.WorkflowInstallFailed, failure, MADE)
    })

    it("makes nothing for a person who may not read the workflows", async () => {
        const { admin, installer } = await build("staff")

        await expect(admin.list(ACTOR, { installationId: "inst-1" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.Forbidden,
        })

        expect(installer.install).not.toHaveBeenCalled()
    })
})
