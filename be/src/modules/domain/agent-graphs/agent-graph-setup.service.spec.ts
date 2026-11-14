import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { branchOf, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowInstallService } from "./agent-workflow-install.service"
import { AgentGraphContractSetupService } from "./agent-graph-contract-setup.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphSetupService } from "./agent-graph-setup.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"

const APPLICANT = { workspaceId: "ws-1", principalId: "user-1", installationId: "inst-1" }
const APPLIER = { ...APPLICANT, version: 8, contextVersionId: "cv-1" }

interface Options {
    readonly state?: OptionalGraphState
    readonly seat?: boolean
    readonly installed?: boolean
}

const build = async (options: Options = {}) => {
    const graphs = mock<AgentGraphsService>({
        stateOfInstallation: jest.fn().mockResolvedValue(options.state === undefined ? stateOf() : options.state),
        latestVersionOf: jest.fn().mockResolvedValue(7),
    })
    const installations = mock<InstallationRecordsService>({
        findById: jest
            .fn()
            .mockResolvedValue(options.installed === false ? null : { id: "inst-1", moduleKey: "accounting" }),
    })
    const publishing = mock<AgentGraphPublishService>({
        publishDraft: jest.fn().mockResolvedValue(undefined),
        requirePublishable: jest.fn().mockResolvedValue(undefined),
    })
    const seats = mock<WorkspaceMemberSeatsService>({
        activeSeatOfUser: jest
            .fn()
            .mockResolvedValue(options.seat === false ? null : { memberId: "boss", role: "owner" }),
    })
    const contracts = mock<AgentGraphContractSetupService>({ proposeFor: jest.fn().mockResolvedValue(2) })
    const workflows = mock<AgentWorkflowInstallService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphSetupService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphPublishService, useValue: publishing },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentGraphContractSetupService, useValue: contracts },
            { provide: AgentWorkflowInstallService, useValue: workflows },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphSetupService), graphs, publishing, contracts, workflows, logger }
}

describe("AgentGraphSetupService.publish", () => {
    it("publishes under the seat that applies, with the context version and the number the setup became", async () => {
        const active = graphOf([branchOf({ key: "else", when: "else", mode: "ask", next: "ask" })])
        const { service, publishing } = await build({ state: stateOf({ active }) })

        await service.publish(APPLIER)

        expect(publishing.publishDraft).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            { memberId: "boss", role: "owner" },
            "",
            "chat",
            "cv-1",
            8,
        )
    })

    it("publishes a draft that did not change from the active graph too, so the version and the mode move", async () => {
        const { service, publishing } = await build()

        await service.publish(APPLIER)

        expect(publishing.publishDraft).toHaveBeenCalledTimes(1)
    })

    it("publishes nothing with no graph, or for an account with no active seat", async () => {
        const none = await build({ state: null })
        const seatless = await build({ state: stateOf({ active: null }), seat: false })

        await none.service.publish(APPLIER)
        await seatless.service.publish(APPLIER)

        expect(none.publishing.publishDraft).not.toHaveBeenCalled()
        expect(seatless.publishing.publishDraft).not.toHaveBeenCalled()
    })
})

describe("AgentGraphSetupService.proposeContracts", () => {
    it("hands the applied setup to the proposals of the contracts", async () => {
        const { service, contracts } = await build()

        await expect(service.proposeContracts(APPLIER)).resolves.toBe(2)

        expect(contracts.proposeFor).toHaveBeenCalledWith(APPLIER)
    })
})

describe("AgentGraphSetupService.checkPublish", () => {
    it("checks the draft under the seat that applies and answers the newest graph version", async () => {
        const { service, publishing, graphs } = await build()

        await expect(service.checkPublish(APPLICANT)).resolves.toBe(7)

        expect(publishing.requirePublishable).toHaveBeenCalledWith("ws-1", "agent-1", {
            memberId: "boss",
            role: "owner",
        })
        expect(graphs.latestVersionOf).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("lets the refusal of the publish through, writing nothing", async () => {
        const { service, publishing } = await build()
        publishing.requirePublishable.mockRejectedValue(
            new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner }),
        )

        await expect(service.checkPublish(APPLICANT)).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WidensNeedsOwner,
        })
        expect(publishing.publishDraft).not.toHaveBeenCalled()
    })

    it("answers 0 with no graph, and the newest version without a check for an account with no seat", async () => {
        const none = await build({ state: null })
        const seatless = await build({ seat: false })

        await expect(none.service.checkPublish(APPLICANT)).resolves.toBe(0)
        await expect(seatless.service.checkPublish(APPLICANT)).resolves.toBe(7)
        expect(seatless.publishing.requirePublishable).not.toHaveBeenCalled()
    })
})

describe("AgentGraphSetupService.publish and the workflows of the agent's plugin", () => {
    it("gives the agent its plugin's workflows once the setup's version is published: an agent installed through the app starts working here", async () => {
        const { service, publishing, workflows } = await build()

        await service.publish(APPLIER)

        expect(workflows.install).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            installationId: APPLIER.installationId,
            moduleKey: "accounting",
        })
        const published = publishing.publishDraft.mock.invocationCallOrder[0] ?? 0
        expect(workflows.install.mock.invocationCallOrder[0]).toBeGreaterThan(published)
    })

    it("lets the applied setup stand when the workflows cannot be made, and logs it; makes none when nothing was published", async () => {
        const { service, workflows, logger } = await build()
        const failure = new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        workflows.install.mockRejectedValue(failure)
        const none = await build({ state: null })

        await expect(service.publish(APPLIER)).resolves.toBeUndefined()
        await none.service.publish(APPLIER)

        expect(logger.error).toHaveBeenCalledWith(
            AgentGraphsLogEvent.WorkflowInstallFailed,
            failure,
            expect.objectContaining({ agentId: "agent-1" }),
        )
        expect(none.workflows.install).not.toHaveBeenCalled()
    })
})
