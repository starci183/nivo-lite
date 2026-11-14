import { Injectable } from "@nestjs/common"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import {
    checkedLayout,
    layoutOfSettings,
    settingsWithLayout,
    type GraphLayoutPosition,
} from "./policies/graph-layout.policy"

@Injectable()
/**
 * Where the owner placed each workflow on the Graph page of an installed agent. It lives in the settings of the installation (no
 * table of its own), is replaced whole on every save and is read without the workflows the agent no longer has. The caller has
 * already checked the seat.
 */
export class AgentGraphLayoutService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly workflows: AgentWorkflowsService,
    ) {}

    /** The saved layout of the installation, kept to the workflows the agent has now. */
    async read(
        workspaceId: string,
        installationId: string,
        agentId: string,
    ): Promise<ReadonlyArray<GraphLayoutPosition>> {
        const installation = await this.installationOf(workspaceId, installationId)
        return layoutOfSettings(installation.settings, await this.keysOf(workspaceId, agentId))
    }

    /** Replaces the layout of the installation and answers what is kept. */
    async save(
        workspaceId: string,
        installationId: string,
        agentId: string,
        positions: ReadonlyArray<GraphLayoutPosition>,
    ): Promise<ReadonlyArray<GraphLayoutPosition>> {
        const installation = await this.installationOf(workspaceId, installationId)
        const kept = checkedLayout(positions, await this.keysOf(workspaceId, agentId))
        const written = await this.installations.saveSettings(
            workspaceId,
            installationId,
            settingsWithLayout(installation.settings, kept),
        )
        if (written !== "done") throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return kept
    }

    private async installationOf(workspaceId: string, installationId: string): Promise<InstallationRecord> {
        const installation = await this.installations.find(workspaceId, installationId)
        if (installation === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return installation
    }

    private async keysOf(workspaceId: string, agentId: string): Promise<ReadonlySet<string>> {
        const views = await this.workflows.list(workspaceId, agentId, "vi")
        return new Set(views.map((view) => view.key))
    }
}
