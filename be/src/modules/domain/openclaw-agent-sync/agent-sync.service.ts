import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { agentIdFor } from "@modules/integrations/openclaw"
import { InjectOpenclawAgentRegistry, InjectOpenclawWorkspaceWriter } from "@modules/integrations/openclaw"
import type { AgentRegistryService, WorkspaceWriterService } from "@modules/integrations/openclaw"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectAgentsQueue, isSyncAgentsPayload } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import { INTERNAL_AGENT_MODULE, INTERNAL_AGENT_NAME, INTERNAL_FILES, scopeOf, syncErrorOf } from "./agent-sync.policy"
import type { OptionalSyncOutcome, SyncAsk, SyncOutcome, SyncRequest } from "./openclaw-agent-sync.contracts"
import { InjectInstallations, processorFromSettings, AgentBundleService, PauseClient } from "@modules/domain/agents"
import type { AgentBundle } from "@modules/domain/agents"
import { InjectSyncOptions } from "./openclaw-agent-sync.decorators"
import { OpenclawAgentSyncLogEvent } from "./openclaw-agent-sync.log-events"
import type { OpenclawAgentSyncOptions } from "./openclaw-agent-sync.options"
import type { Installation, InstallationDirectory, InstallationRef } from "@modules/domain/agents"
import { OpenclawAgentSyncError, OpenclawAgentSyncErrorCode } from "./errors/openclaw-agent-sync.error"
import type { SyncStateRow } from "./persistence/openclaw-agent-sync.rows"
import {
    FIND_SYNC_STATE,
    RECORD_SYNC_CHECKED,
    RECORD_SYNC_FAILED,
    RECORD_SYNC_WRITTEN,
} from "./persistence/openclaw-agent-sync.sql"

/** Who may ask for a sync. */
const GOVERNORS = ["owner", "manager"] as const

/** The most installations one scope syncs in one job. */
const SCOPE_LIMIT = 500

@Injectable()
/**
 * One-way sync of an agent's OpenClaw workspace from Supabase: the bundle is built from the database, written file by file (changed
 * files only), the agent is registered in openclaw.json after its files are complete, and what was written is recorded on
 * `openclaw_agent_sync`. When the hash, the files on disk and the registration are all current only the check time moves. The job
 * `agents.sync` calls `process`; a change of an agent, its context or the business knowledge calls `request`.
 */
export class AgentSyncService {
    constructor(
        @InjectSyncOptions() private readonly options: OpenclawAgentSyncOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectOpenclawAgentRegistry() private readonly registry: AgentRegistryService,
        @InjectOpenclawWorkspaceWriter() private readonly writer: WorkspaceWriterService,
        private readonly bundles: AgentBundleService,
        @InjectAgentsQueue() private readonly queue: AgentsQueue,
        private readonly pause: PauseClient,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Queues a sync of one installation (or of a whole workspace) in the caller's transaction; requests of one minute are one job. */
    request(request: SyncRequest, tx: EntityManager): Promise<void> {
        return this.queue.enqueueSyncAgents(
            {
                workspaceId: request.workspaceId,
                ...(request.installationId === null ? {} : { installationId: request.installationId }),
                force: request.force,
                requestedAt: this.clock.now().getTime(),
            },
            tx,
        )
    }

    /** Queues a sync in its own transaction, for a caller that has none open. */
    requestNow(request: SyncRequest): Promise<void> {
        return this.entityManager.transaction((tx) => this.request(request, tx))
    }

    /** Queues a sync on behalf of a signed-in owner or manager of the workspace the request names. */
    async requestFor(userId: string, ask: SyncAsk): Promise<void> {
        await this.members.require(userId, ask.workspaceId, GOVERNORS)
        await this.requestNow({
            workspaceId: ask.workspaceId,
            installationId: ask.installationId ?? null,
            force: ask.force ?? false,
        })
    }

    /**
     * Works one sync job: an installation is synced now; a workspace (business knowledge changed, it is shared by the modules) or
     * everything on OpenClaw (the scheduler tick) is fanned out into one job per installation. Answers how many it handled.
     */
    async process(payload: object): Promise<number> {
        if (!isSyncAgentsPayload(payload)) return 0
        const scope = scopeOf(payload)
        if (scope === null) return 0
        if (scope.kind === "installation") {
            const outcome = await this.syncInstallation(scope.workspaceId, scope.installationId, scope.force)
            return outcome === null ? 0 : 1
        }
        const refs = await this.installations.onOpenclaw(
            scope.kind === "workspace" ? scope.workspaceId : null,
            SCOPE_LIMIT,
        )
        await this.fanOut(refs)
        return refs.length
    }

    /** Syncs one installation; null when it is gone, or not on OpenClaw and not forced. A failure is recorded on the sync row and rethrown. */
    async syncInstallation(workspaceId: string, installationId: string, force: boolean): Promise<OptionalSyncOutcome> {
        const installation = await this.installations.byId(workspaceId, installationId)
        if (installation === null) return null
        if (!force && processorFromSettings(installation.settings) !== "openclaw") return null
        try {
            return await this.apply(await this.bundles.build(installation))
        } catch (cause) {
            this.logger.error(OpenclawAgentSyncLogEvent.SyncFailed, cause, { installationId })
            await this.recordFailure(installation, cause)
            throw cause
        }
    }

    /** The workspace's internal "nivo" agent that runs generations: created on first use, then only verified (its files and its entry in openclaw.json). */
    async ensureInternalAgent(workspaceId: string): Promise<string> {
        const agentId = agentIdFor(workspaceId, INTERNAL_AGENT_MODULE)
        const dirs = this.registry.workspaceDirs(agentId)
        if (dirs === null) throw new OpenclawAgentSyncError({ code: OpenclawAgentSyncErrorCode.WorkspaceUnavailable })
        if (!this.writer.matches(dirs.local, INTERNAL_FILES)) this.writer.write(dirs.local, INTERNAL_FILES)
        if (
            !this.registry.isCurrent(agentId, INTERNAL_AGENT_NAME) &&
            this.registry.register(agentId, INTERNAL_AGENT_NAME)
        ) {
            await this.pause.wait(this.options.reloadSettleMs)
        }
        return agentId
    }

    private async fanOut(refs: ReadonlyArray<InstallationRef>): Promise<void> {
        const requestedAt = this.clock.now().getTime()
        await this.entityManager.transaction((tx) =>
            eachInOrder(refs, (ref) =>
                this.queue.enqueueSyncAgents({ workspaceId: ref.workspaceId, installationId: ref.id, requestedAt }, tx),
            ),
        )
    }

    private async apply(bundle: AgentBundle): Promise<SyncOutcome> {
        const dirs = this.registry.workspaceDirs(bundle.agentId)
        if (dirs === null) throw new OpenclawAgentSyncError({ code: OpenclawAgentSyncErrorCode.WorkspaceUnavailable })
        const hash = this.writer.contentHash(bundle.files)
        const [previous] = await this.entityManager.query<Array<SyncStateRow>>(FIND_SYNC_STATE, [bundle.installationId])
        const record = [
            bundle.installationId,
            bundle.workspaceId,
            bundle.agentId,
            this.clock.now().toISOString(),
            bundle.contextVersion,
            hash,
            JSON.stringify(this.writer.metaOf(bundle.files)),
        ]
        const outcome = {
            agentId: bundle.agentId,
            contextVersion: bundle.contextVersion,
            files: bundle.files.length,
            contentHash: hash,
        }
        const current =
            previous?.content_hash === hash &&
            this.writer.matches(dirs.local, bundle.files) &&
            this.registry.isCurrent(bundle.agentId, bundle.agentName)
        if (current) {
            await this.entityManager.query(RECORD_SYNC_CHECKED, record)
            return { ...outcome, changed: false, written: 0, removed: 0, registered: false }
        }
        // Files first, registration after: the gateway only ever sees an agent whose workspace is complete.
        const { written, removed } = this.writer.write(dirs.local, bundle.files)
        const registered = this.registry.register(bundle.agentId, bundle.agentName)
        if (registered) await this.pause.wait(this.options.reloadSettleMs)
        await this.entityManager.query(RECORD_SYNC_WRITTEN, record)
        this.logger.info(OpenclawAgentSyncLogEvent.AgentSynced, {
            agentId: bundle.agentId,
            written,
            removed,
            registered,
        })
        return { ...outcome, changed: true, written, removed, registered }
    }

    private recordFailure(installation: Installation, cause: unknown): Promise<void> {
        return this.entityManager
            .query(RECORD_SYNC_FAILED, [
                installation.id,
                installation.workspaceId,
                agentIdFor(installation.workspaceId, installation.module),
                this.clock.now().toISOString(),
                syncErrorOf(cause),
            ])
            .then(() => undefined)
            .catch((error_: unknown) => {
                this.logger.error(OpenclawAgentSyncLogEvent.SyncFailureNotRecorded, error_, {
                    installationId: installation.id,
                })
            })
    }
}
