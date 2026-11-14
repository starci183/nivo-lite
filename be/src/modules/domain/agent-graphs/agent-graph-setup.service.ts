import { Injectable, Optional } from "@nestjs/common"
import type { SetupApplicant, SetupApplier, SetupGraphPort } from "@modules/domain/modules"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphContractSetupService } from "./agent-graph-contract-setup.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowInstallService } from "./agent-workflow-install.service"
import { AgentGraphsService } from "./agent-graphs.service"

@Injectable()
/**
 * The action graph of an installation as the setup chat sees it: applying the setup publishes the draft with the context version and the
 * number it became (under the right of the seat that applies; a widening stays the owner's). The setup chat writes no branch and asks
 * about no vague place of the graph: those were the authority rules' bands and approvers, gone 2026-11-13.
 */
export class AgentGraphSetupService implements SetupGraphPort {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly publishing: AgentGraphPublishService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly contracts: AgentGraphContractSetupService,
        @Optional() private readonly workflows?: AgentWorkflowInstallService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
    ) {}

    /**
     * Refuses, before the setup writes anything, when publishing the draft would be refused (a problem in the graph, or a widening applied
     * by a manager), and answers the number of the newest graph version, 0 when the installation has no graph.
     */
    async checkPublish(applicant: SetupApplicant): Promise<number> {
        const state = await this.graphs.stateOfInstallation(applicant.workspaceId, applicant.installationId)
        if (state === null) return 0
        const seat = await this.seats.activeSeatOfUser(applicant.workspaceId, applicant.principalId)
        if (seat !== null)
            await this.publishing.requirePublishable(applicant.workspaceId, state.agentId, {
                memberId: seat.memberId,
                role: seat.role,
            })
        return this.graphs.latestVersionOf(applicant.workspaceId, state.agentId)
    }

    /**
     * Publishes the draft of the graph as the version the setup became, with its context version and its number, even when the map did
     * not change; an owner applying makes the graph decide, a manager leaves the mode as it was. The graph is then one a person
     * published, so the agent is given the workflows its plugin ships where it holds none (the primary template as the flow it
     * runs): an agent installed through the app starts working when its setup is applied. A failure there is logged and the setup
     * stands; the next door (the workflows page, the next apply) makes them.
     */
    async publish(applier: SetupApplier): Promise<void> {
        const state = await this.graphs.stateOfInstallation(applier.workspaceId, applier.installationId)
        if (state === null) return
        const seat = await this.seats.activeSeatOfUser(applier.workspaceId, applier.principalId)
        if (seat === null) return
        await this.publishing.publishDraft(
            applier.workspaceId,
            state.agentId,
            { memberId: seat.memberId, role: seat.role },
            "",
            "chat",
            applier.contextVersionId,
            applier.version,
        )
        const installation = await this.installations.findById(applier.installationId)
        if (installation === null) return
        const { workspaceId, installationId } = applier
        const made = { workspaceId, agentId: state.agentId, installationId, moduleKey: installation.moduleKey }
        try {
            await this.workflows?.install(made)
        } catch (cause: unknown) {
            if (this.logger === undefined) throw cause
            this.logger.error(AgentGraphsLogEvent.WorkflowInstallFailed, cause, made)
        }
    }

    /** Proposes the contracts and gaps the applied setup calls for, for the owner to approve. */
    proposeContracts(applier: SetupApplier): Promise<number> {
        return this.contracts.proposeFor(applier)
    }
}
