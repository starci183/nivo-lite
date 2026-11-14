import { Injectable, Optional } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionsService, type ConnectionActor } from "@modules/domain/connections"
import {
    INSTALLED,
    WEBSITE_CHANNEL,
    customerChannelProviders,
    installedFrontDoorsOf,
    type FrontDoorChannel,
} from "@modules/domain/installed-plugins"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { AgentAccountsService } from "@modules/domain/tools"
import { WorkspaceEnterpriseService, WorkspacesService } from "@modules/domain/workspaces"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { Locale } from "@modules/platform/i18n"
import { AgentInstanceCreationService } from "./agent-instance-creation.service"
import type { CreatedAgent } from "./agent-instances.contracts"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { AgentInstancesError, AgentInstancesErrorCode } from "./errors/agent-instances.error"

/** The language the installed agent is named in, as the seed names the agents it installs. */
const FRONT_DOOR_LOCALE: Locale = "vi"

/** The channel already has its front door: left exactly as it is. */
type HeldFrontDoor = { readonly kind: "held"; readonly module: string; readonly agentId: string | null }

/**
 * What making sure a customer channel has an owning agent found or did: no installed template declares a front door for the channel (nobody
 * can answer it: the capability is missing), the channel already has its front door (left exactly as it is), the workspace's existing front
 * door was attached to the new connection, or the front door was installed for this connection.
 */
export type FrontDoorOutcome =
    | { readonly kind: "none" }
    | HeldFrontDoor
    | { readonly kind: "attached"; readonly module: string; readonly agentId: string }
    | { readonly kind: "installed"; readonly module: string; readonly agentId: string; readonly installationId: string }

@Injectable()
/**
 * A customer channel (Zalo OA, Telegram, Meta, the website form) has exactly ONE front door: the agent that answers its stream. Connecting
 * the channel makes sure it has one. Which template is the front door is read from the installation, never named here: the template agents
 * with a graph that wakes on a customer message of the channel (`installed-channels.policy`), that the workspace may hold, a private
 * plugin's template before a public one (so an enterprise workspace's own front door owns the stream and the shared one is not installed
 * beside it), then the installation's order. When the workspace holds none of them the winner is installed through the same creation the
 * agents page uses (the installation, its workflows, the rights on the connected providers, the connection's inbound grant); when it
 * already holds some, the best of the ones it holds is ATTACHED to the new connection with the same writers (the inbound binding, the
 * rights on the connected providers); a connection that already has its front door is left as it is. Idempotent. A failure to install or
 * attach is thrown (`FrontDoorFailed`) and marks the connection in error, so a channel is never left connected with nobody behind it. The
 * raw delivery is stored by the intake whether or not an agent answers.
 */
export class ChannelFrontDoorService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly installations: InstallationRecordsService,
        private readonly catalog: ModulesService,
        private readonly creation: AgentInstanceCreationService,
        private readonly workspaces: WorkspacesService,
        private readonly grants: ConnectionGrantsService,
        private readonly bindings: AgentBindingsService,
        private readonly accounts: AgentAccountsService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly enterprise?: WorkspaceEnterpriseService,
    ) {}

    /**
     * Makes sure the channel connection has its front door installed and attached; the connection is of the actor's workspace. A connection
     * that is no customer channel (a bank feed, a mailbox) has none: `none`, without a warning.
     */
    async ensureForConnection(actor: ConnectionActor, connectionId: string): Promise<FrontDoorOutcome> {
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (!customerChannelProviders().has(connection.provider)) return { kind: "none" }
        return this.ensure(actor.workspaceId, connection.provider, connection.id)
    }

    /** Makes sure the workspace's website form has its front door installed: the form has no connection to attach. */
    ensureForWebsite(actor: ConnectionActor): Promise<FrontDoorOutcome> {
        return this.ensure(actor.workspaceId, WEBSITE_CHANNEL, null)
    }

    private async ensure(
        workspaceId: string,
        channel: FrontDoorChannel,
        connectionId: string | null,
    ): Promise<FrontDoorOutcome> {
        const open = await this.openOf(workspaceId, installedFrontDoorsOf(channel))
        const [wanted] = open
        if (wanted === undefined) {
            this.logger.warn(AgentInstancesLogEvent.FrontDoorMissing, { workspaceId, channel })
            return { kind: "none" }
        }
        try {
            const held = await this.heldOf(workspaceId, open)
            if (held === null) return await this.installed(workspaceId, channel, wanted, connectionId)
            if (connectionId === null || held.agentId === null) return held
            return await this.attached(workspaceId, held.module, held.agentId, connectionId)
        } catch (cause: unknown) {
            this.logger.error(AgentInstancesLogEvent.FrontDoorFailed, cause, { workspaceId, channel, module: wanted })
            if (connectionId !== null) await this.markInError(workspaceId, connectionId)
            throw new AgentInstancesError({
                code: AgentInstancesErrorCode.FrontDoorFailed,
                params: { module: wanted },
                cause,
            })
        }
    }

    /** Installs the winner for the workspace as its owner would on the agents page, answering the connection when there is one. */
    private async installed(
        workspaceId: string,
        channel: FrontDoorChannel,
        module: string,
        connectionId: string | null,
    ): Promise<FrontDoorOutcome> {
        const created = await this.install(workspaceId, module, connectionId)
        this.logger.info(AgentInstancesLogEvent.FrontDoorInstalled, { workspaceId, channel, module })
        return { kind: "installed", module, agentId: created.agentId, installationId: created.installationId }
    }

    /**
     * Gives the workspace's front door the new connection: the inbound binding (the agents page's grant writer, which refuses a second
     * front door on one stream) and the rights on the connected providers (the attach the creation makes, which leaves a right the agent
     * already holds as it is). A connection that already has its front door is left as it is: that agent is the answer.
     */
    private async attached(
        workspaceId: string,
        module: string,
        agentId: string,
        connectionId: string,
    ): Promise<FrontDoorOutcome> {
        const ownerId = await this.requireOwner(workspaceId, module)
        const holder = await this.bindings.owningAgentOf(workspaceId, connectionId)
        if (holder === null) {
            await this.grants.setGrant({ principalId: ownerId, workspaceId }, connectionId, agentId, true)
        }
        const rights = await this.accounts.attachDefaults({ workspaceId, agentId, moduleKey: module }, null, ownerId)
        if (!rights.ok) {
            throw new AgentInstancesError({ code: AgentInstancesErrorCode.FrontDoorFailed, params: { module } })
        }
        if (holder !== null) return { kind: "held", module, agentId: holder }
        this.logger.info(AgentInstancesLogEvent.FrontDoorAttached, { workspaceId, connectionId, module })
        return { kind: "attached", module, agentId }
    }

    /** The modules of the list the workspace may hold, in the list's order. */
    private async openOf(workspaceId: string, modules: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const checks = await Promise.all(
            modules.map(async (module) => ({
                module,
                open:
                    this.enterprise === undefined
                        ? INSTALLED.isOpenTo(module, null)
                        : await this.enterprise.opens(workspaceId, module),
            })),
        )
        return checks.filter((check) => check.open).map((check) => check.module)
    }

    /** The agent of the best of these modules the workspace already holds (not removed), or null when it holds none. */
    private async heldOf(workspaceId: string, modules: ReadonlyArray<string>): Promise<HeldFrontDoor | null> {
        const installed = await this.installations.list(workspaceId)
        for (const module of modules) {
            const found = installed.find((record) => record.moduleKey === module)
            if (found !== undefined) return { kind: "held", module, agentId: found.agentId }
        }
        return null
    }

    private async requireOwner(workspaceId: string, module: string): Promise<string> {
        const ownerId = await this.workspaces.ownerIdOf(workspaceId)
        if (ownerId === null) {
            throw new AgentInstancesError({ code: AgentInstancesErrorCode.FrontDoorFailed, params: { module } })
        }
        return ownerId
    }

    /** Installs the module for the workspace as its owner would on the agents page, answering the connection when there is one. */
    private async install(workspaceId: string, moduleKey: string, connectionId: string | null): Promise<CreatedAgent> {
        const ownerId = await this.requireOwner(workspaceId, moduleKey)
        const module = await this.catalog.find(moduleKey)
        return this.creation.create(ownerId, {
            workspaceId,
            moduleKey,
            locale: FRONT_DOOR_LOCALE,
            name: module.agent.label[FRONT_DOOR_LOCALE],
            handle: null,
            avatarPreset: null,
            avatarPath: null,
            connectionIds: connectionId === null ? [] : [connectionId],
            startFrom: "default",
            copyFrom: null,
        })
    }

    /** Marks the connection failing for the owner to see; a failure to mark it is logged, never thrown over the install failure. */
    private async markInError(workspaceId: string, connectionId: string): Promise<void> {
        try {
            await this.connections.patch(workspaceId, connectionId, {
                status: "error",
                lastError: AgentInstancesErrorCode.FrontDoorFailed,
            })
        } catch (cause: unknown) {
            this.logger.error(AgentInstancesLogEvent.FrontDoorFailed, cause, { workspaceId, connectionId })
        }
    }
}
