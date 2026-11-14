import { Injectable } from "@nestjs/common"
import {
    AgentGraphPublishService,
    AgentGraphSeedService,
    AgentGraphsError,
    AgentGraphsService,
    AgentWorkflowsService,
} from "@modules/domain/agent-graphs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import type { Locale } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { copiedGrantsOf } from "./agent-instances.policy"
import { AgentKnowledgeCopyService } from "./agent-knowledge-copy.service"
import type { CopiedGrant, CopiedSetup, CopyPublisher, GraphCopy } from "./agent-instances.contracts"

/** The new agent a setup is copied onto. */
export interface CopyTarget {
    /** Its installation. */
    readonly installationId: string
    /** Its agent. */
    readonly agentId: string
}

/** What a copy did, with the shared connections the creation then grants (the owner grants connections). */
export interface CopyOutcome {
    /** What came over. */
    readonly copied: Omit<CopiedSetup, "connections">
    /** The shared connections to grant like the sibling's. */
    readonly grants: ReadonlyArray<CopiedGrant>
}

@Injectable()
/**
 * "Copy the setup of <agent>": a new agent of a role starts where a sibling of the same role is. It takes the sibling's settings, its
 * applied setup version, its graph version (under the same checks as any publish), and the shared connections it uses. It never takes a channel: a channel the
 * sibling answers stays the sibling's, since each channel has one agent per role. The knowledge view of the role is shared already; the
 * knowledge kept for the sibling alone is copied as the new agent's own private knowledge (see AgentKnowledgeCopyService).
 */
export class AgentSetupCopyService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly versions: ContextVersionsService,
        private readonly graphs: AgentGraphsService,
        private readonly seed: AgentGraphSeedService,
        private readonly publish: AgentGraphPublishService,
        private readonly grants: ConnectionGrantsService,
        @InjectLogger() private readonly logger: Logger,
        private readonly workflows: AgentWorkflowsService,
        private readonly knowledge: AgentKnowledgeCopyService,
    ) {}

    /** Copies the setup of `source` onto the new agent. */
    async copy(
        source: InstallationRecord,
        target: CopyTarget,
        by: CopyPublisher,
        locale: Locale,
    ): Promise<CopyOutcome> {
        const { workspaceId } = source
        await this.installations.saveSettings(workspaceId, target.installationId, source.settings)
        const contextVersion = await this.copyVersion(source, target)
        const knowledge = await this.knowledge.copy(source, target.installationId, by)
        const sourceAgentId = source.agentId
        if (sourceAgentId === null) {
            return {
                copied: { fromInstallationId: source.id, settings: true, contextVersion, graph: "none", ...knowledge },
                grants: [],
            }
        }
        const graph = await this.copyGraph(source, sourceAgentId, target, by, locale)
        const sibling = await this.grants.candidatesOf(workspaceId, sourceAgentId, source.moduleKey)
        return {
            copied: { fromInstallationId: source.id, settings: true, contextVersion, graph, ...knowledge },
            grants: copiedGrantsOf(sibling),
        }
    }

    /** The sibling's applied setup version as the first version of the new agent, which then reads as ready. */
    private async copyVersion(source: InstallationRecord, target: CopyTarget): Promise<boolean> {
        if (source.activeContextVersionId === null) return false
        const version = await this.versions.find(source.activeContextVersionId)
        if (version === null) return false
        const copied = await this.versions.insert({
            workspaceId: source.workspaceId,
            installationId: target.installationId,
            version: 1,
            snapshot: version.snapshot,
            appliedBy: version.appliedBy,
        })
        await this.installations.activateVersion(source.workspaceId, target.installationId, copied.id, "ready")
        return true
    }

    /**
     * The sibling's graph version published on the new agent under the graph checks, then every workflow of the sibling copied with its
     * current snapshot as version 1 and its template provenance (the primary one adopting the graph just published). A copy the checks
     * refuse leaves the new agent on its seed graph and copies no workflow.
     */
    private async copyGraph(
        source: InstallationRecord,
        sourceAgentId: string,
        target: CopyTarget,
        by: CopyPublisher,
        locale: Locale,
    ): Promise<GraphCopy> {
        const state = await this.graphs.stateOfAgent(source.workspaceId, sourceAgentId)
        if (state?.active === null || state?.active === undefined || state.activeKind === "seed") return "none"
        await this.seed.ensureFor(target.installationId, locale)
        try {
            // The target was made in this call: what its flow asks beyond what is agreed waits for the owner, never refuses.
            await this.publish.publishCopy(source.workspaceId, target.agentId, state.active, by, [], "wait")
            await this.workflows.copyWorkflows(
                source.workspaceId,
                { fromInstallationId: source.id, toInstallationId: target.installationId },
                { kind: "owner", memberId: by.memberId },
            )
            return "copied"
        } catch (cause: unknown) {
            if (!(cause instanceof AgentGraphsError)) throw cause
            this.logger.warn(AgentInstancesLogEvent.GraphCopyRefused, {
                workspaceId: source.workspaceId,
                agentId: target.agentId,
                code: cause.code,
            })
            return "refused"
        }
    }
}
