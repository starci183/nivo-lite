import { Injectable, Optional } from "@nestjs/common"
import { AgentWorkflowInstallService } from "@modules/domain/agent-graphs"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { AgentIdentityService } from "@modules/domain/agents"
import { AvatarsService } from "@modules/domain/avatars"
import { ConnectionGrantsService, purposeFor } from "@modules/domain/connection-grants"
import { ConnectionsService } from "@modules/domain/connections"
import { ToolsError, ToolsErrorCode, AgentAccountsService } from "@modules/domain/tools"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { AgentRemovalService, ModuleInstallService, ModulesService } from "@modules/domain/modules"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { channelChoicesOf, channelProblemOf, copySourceIdOf, judgeRequest } from "./agent-instances.policy"
import type {
    AvatarChoice,
    ChannelChoice,
    CopiedGrant,
    CreateAgentInstanceRequest,
    CreatedAgent,
} from "./agent-instances.contracts"
import { AgentSetupCopyService, type CopyOutcome, type CopyTarget } from "./agent-setup-copy.service"
import { AgentInstancesError, AgentInstancesErrorCode } from "./errors/agent-instances.error"

/** The installation a creation made and the agent behind it, when it has one. */
type MadeInstallation = { readonly installationId: string; readonly agentId: string | null }

/** The installation a creation made and whether this call created it. */
type CreatedInstallation = { readonly installationId: string; readonly created: boolean }

/** What the copy of a sibling setup is asked to give the new agent. */
type CopyAsk = {
    readonly avatar: AvatarChoice
    readonly channels: ReadonlyArray<string>
    readonly rights: CreateAgentInstanceRequest["providerRights"] | null
    readonly moduleKey: string
}

const GOVERNORS = ["owner", "manager"] as const

@Injectable()
/**
 * One role, many agents: creates one more agent of a role (the create dialog of the agents page) with the name its customers see, a
 * @handle, a picture, the channels it answers and, on request, the setup of a sibling of the same role. Each channel is answered by
 * exactly one agent of a role, so a channel another agent of the role answers is refused before anything is written. Managers create
 * agents; only the owner gives an agent connections. The new agent is attached to the working accounts of the providers its module's
 * template lists, or to the accounts of the owner's edit of that proposal (checked before anything is written); these attachments are
 * then the workspace's (nivo-frame `rights`: an attachment carries no mode). A creation is all or nothing as far as anyone can see: when
 * a step after the installation fails (the copy, a channel, the attachments), the installation is removed again through the removal door
 * and the failure is thrown.
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
        private readonly accounts: AgentAccountsService,
        private readonly removal: AgentRemovalService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly workflows?: AgentWorkflowInstallService,
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
        const rights = request.providerRights ?? null
        const problem = rights === null ? null : await this.accounts.wishProblem(request.workspaceId, rights)
        if (problem !== null)
            throw new ToolsError({ code: ToolsErrorCode.AttachmentRefused, params: { reason: problem } })
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
        // Everything after the installation exists either all holds or the installation is taken back: a creation that fails half way
        // leaves no agent in any list and its name free.
        const outcome = await this.furnished(principalId, member, request, source, made, {
            avatar: judged.value.avatar,
            channels: wanted,
            rights,
            moduleKey: module.key,
        }).catch(async (cause: unknown) => {
            await this.undone(principalId, request.workspaceId, made)
            throw cause
        })
        if (agentId === null) throw new AgentInstancesError({ code: AgentInstancesErrorCode.CopySourceInvalid })
        const shared = member.role === "owner" ? (outcome?.grants ?? []) : []
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

    /**
     * Gives the installation just made everything the request asks for: the picture, the sibling's setup, the channels and shared
     * connections, the rights on the connected providers, and a workflow from each template its plugin ships. Any failure is thrown for `create` to take the installation back.
     */
    private async furnished(
        principalId: string,
        member: WorkspaceMember,
        request: CreateAgentInstanceRequest,
        source: InstallationRecord | null,
        made: MadeInstallation,
        asked: CopyAsk,
    ): Promise<CopyOutcome | null> {
        const { agentId } = made
        if (agentId === null) throw new AgentInstancesError({ code: AgentInstancesErrorCode.CopySourceInvalid })
        await this.dress(principalId, request.workspaceId, agentId, asked.avatar)
        const target = { installationId: made.installationId, agentId }
        const outcome = await this.copyOf(principalId, member, request, source, target)
        const shared = member.role === "owner" ? (outcome?.grants ?? []) : []
        await this.grantAll(principalId, request.workspaceId, agentId, asked.channels, shared)
        // The rights of the new agent on the connected providers: the owner's edit of the proposal, else the module's proposal as it is.
        await this.accounts.attachDefaults(
            { workspaceId: request.workspaceId, agentId, moduleKey: asked.moduleKey },
            asked.rights ?? null,
            principalId,
        )
        // After the rights: the workflows the module's plugin ships, made the way the stack seed makes a seeded shop's.
        await this.workflows?.install({
            workspaceId: request.workspaceId,
            agentId,
            installationId: made.installationId,
            moduleKey: asked.moduleKey,
        })
        return outcome
    }

    /**
     * Takes back an installation this creation made and could not finish, through the same door a person removes an agent with: the
     * installation is removed, its agent paused and its rights switched off, so it is in no list, serves nobody and its name is free
     * again. An installation the creation did not make itself (another tab made it first) is left alone. A removal that fails is
     * logged with the installation, never thrown over the failure that caused it.
     */
    private async undone(
        principalId: string,
        workspaceId: string,
        made: CreatedInstallation,
    ): Promise<void> {
        if (!made.created) return
        try {
            await this.removal.remove(principalId, workspaceId, made.installationId)
            this.logger.warn(AgentInstancesLogEvent.CreationUndone, {
                workspaceId,
                installationId: made.installationId,
            })
        } catch (cause) {
            this.logger.error(AgentInstancesLogEvent.CreationUndoFailed, cause, {
                workspaceId,
                installationId: made.installationId,
            })
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
