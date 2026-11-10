import { Injectable } from "@nestjs/common"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { AgentIdentityService } from "@modules/domain/agents"
import { AvatarsService } from "@modules/domain/avatars"
import { ConnectionGrantsService, purposeFor } from "@modules/domain/connection-grants"
import { ConnectionsService } from "@modules/domain/connections"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ModuleInstallService, ModulesService } from "@modules/domain/modules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { channelChoicesOf, channelProblemOf, copySourceIdOf, judgeRequest } from "./agent-instances.policy"
import type {
    AvatarChoice,
    ChannelChoice,
    CopiedGrant,
    CreateAgentInstanceRequest,
    CreatedAgent,
} from "./agent-instances.contracts"
import { AgentSetupCopyService } from "./agent-setup-copy.service"
import type { CopyOutcome, CopyTarget } from "./agent-setup-copy.service"
import { AgentInstancesError, AgentInstancesErrorCode } from "./errors/agent-instances.error"

const GOVERNORS = ["owner", "manager"] as const

@Injectable()
/**
 * One role, many agents: creates one more agent of a role (the create dialog of the agents page) with the name its customers see, a
 * @handle, a picture, the channels it answers and, on request, the setup of a sibling of the same role. Each channel is answered by
 * exactly one agent of a role, so a channel another agent of the role answers is refused before anything is written. Managers create
 * agents; only the owner gives an agent connections.
 */
export class AgentInstanceCreationService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly catalog: ModulesService,
        private readonly install: ModuleInstallService,
        private readonly installations: InstallationRecordsService,
        private readonly identity: AgentIdentityService,
        private readonly avatars: AvatarsService,
        private readonly connections: ConnectionsService,
        private readonly grants: ConnectionGrantsService,
        private readonly owners: ChannelOwnersService,
        private readonly setupCopy: AgentSetupCopyService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The channels a new agent of the role could answer, each with the agent of the role that answers it already; any member may look. */
    async channelChoices(
        principalId: string,
        workspaceId: string,
        moduleKey: string,
    ): Promise<ReadonlyArray<ChannelChoice>> {
        await this.members.require(principalId, workspaceId)
        const module = await this.catalog.find(moduleKey)
        return this.choicesOf(workspaceId, module.key)
    }

    /** Creates the agent; refused, with nothing written, when the name, handle, picture, sibling or a channel does not hold. */
    async create(principalId: string, request: CreateAgentInstanceRequest): Promise<CreatedAgent> {
        const member = await this.members.require(principalId, request.workspaceId, GOVERNORS)
        const module = await this.catalog.find(request.moduleKey)
        const judged = judgeRequest(request)
        if (judged.kind === "refused") throw new AgentInstancesError({ code: judged.code, params: judged.params })
        const wanted = [...new Set(request.connectionIds)]
        if (wanted.length > 0 && member.role !== "owner") {
            throw new AgentInstancesError({ code: AgentInstancesErrorCode.ChannelsNeedOwner })
        }
        const source = await this.sourceOf(request, module.key)
        await this.requireChannelsFree(request.workspaceId, module.key, wanted)
        const present = await this.installations.firstOfModule(request.workspaceId, module.key)
        const made = await this.install.install(principalId, {
            workspaceId: request.workspaceId,
            moduleKey: module.key,
            locale: request.locale,
            newInstance: present !== null,
            name: null,
            agent: { name: judged.value.name, handle: judged.value.handle },
        })
        const agentId = made.agentId
        if (agentId === null) throw new AgentInstancesError({ code: AgentInstancesErrorCode.CopySourceInvalid })
        await this.dress(principalId, request.workspaceId, agentId, judged.value.avatar)
        const target = { installationId: made.installationId, agentId }
        const outcome = await this.copyOf(principalId, member, request, source, target)
        const shared = member.role === "owner" ? (outcome?.grants ?? []) : []
        await this.grantAll(principalId, request.workspaceId, agentId, wanted, shared)
        this.logger.info(AgentInstancesLogEvent.Created, {
            workspaceId: request.workspaceId,
            moduleKey: module.key,
            installationId: made.installationId,
            copied: source !== null,
            channels: wanted.length,
        })
        return {
            installationId: made.installationId,
            agentId,
            copied: outcome === null ? null : { ...outcome.copied, connections: shared.length },
            channels: wanted.length,
        }
    }

    private async choicesOf(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<ChannelChoice>> {
        const [listed, owners] = await Promise.all([
            this.connections.list(workspaceId),
            this.owners.ownersOf(workspaceId, moduleKey),
        ])
        return channelChoicesOf(
            listed.map((connection) => ({
                id: connection.id,
                name: connection.name,
                provider: connection.provider,
                status: connection.status,
                botUsername: connection.meta["bot_username"] ?? null,
            })),
            (provider) => purposeFor(moduleKey, provider),
            (connectionId) => {
                const owner = owners.find((entry) => entry.connectionId === connectionId)
                return { ownerAgentId: owner?.agentId ?? null, ownerAgentName: owner?.agentName ?? null }
            },
        )
    }

    /** The sibling to copy the setup of: an installation of the same role in the workspace that was not removed. */
    private async sourceOf(request: CreateAgentInstanceRequest, moduleKey: string): Promise<InstallationRecord | null> {
        const sourceId = copySourceIdOf(request)
        if (sourceId === null) return null
        const source = await this.installations.find(request.workspaceId, sourceId)
        if (source?.moduleKey !== moduleKey || source.status === "removed") {
            throw new AgentInstancesError({ code: AgentInstancesErrorCode.CopySourceInvalid })
        }
        return source
    }

    private async requireChannelsFree(
        workspaceId: string,
        moduleKey: string,
        wanted: ReadonlyArray<string>,
    ): Promise<void> {
        if (wanted.length === 0) return
        const problem = channelProblemOf(await this.choicesOf(workspaceId, moduleKey), wanted)
        if (problem === null) return
        if (problem.kind === "owned") {
            throw new AgentInstancesError({
                code: AgentInstancesErrorCode.ChannelOwned,
                params: { agent: problem.agentName, connectionId: problem.connectionId },
            })
        }
        throw new AgentInstancesError({
            code: AgentInstancesErrorCode.ChannelUnavailable,
            params: { connectionId: problem.connectionId },
        })
    }

    /** Puts the chosen picture on the new agent; none keeps the default sprout. */
    private async dress(
        principalId: string,
        workspaceId: string,
        agentId: string,
        avatar: AvatarChoice,
    ): Promise<void> {
        if (avatar === null) return
        if (avatar.kind === "preset") {
            await this.identity.setAvatarPreset(principalId, workspaceId, agentId, avatar.preset)
            return
        }
        await this.avatars.setAgentAvatar(principalId, workspaceId, agentId, avatar.path)
    }

    private async copyOf(
        principalId: string,
        member: WorkspaceMember,
        request: CreateAgentInstanceRequest,
        source: InstallationRecord | null,
        target: CopyTarget,
    ): Promise<CopyOutcome | null> {
        if (source === null) return null
        const memberId = await this.members.idOf(principalId, request.workspaceId)
        return this.setupCopy.copy(source, target, { userId: principalId, memberId, role: member.role }, request.locale)
    }

    /** Grants the chosen channels and the copied shared connections in one owner write. */
    private async grantAll(
        principalId: string,
        workspaceId: string,
        agentId: string,
        channels: ReadonlyArray<string>,
        shared: ReadonlyArray<CopiedGrant>,
    ): Promise<void> {
        if (channels.length === 0 && shared.length === 0) return
        await this.grants.setAgentConnections({ principalId, workspaceId }, agentId, [
            ...channels.map((connectionId) => ({ connectionId })),
            ...shared.filter((grant) => !channels.includes(grant.connectionId)),
        ])
    }
}
