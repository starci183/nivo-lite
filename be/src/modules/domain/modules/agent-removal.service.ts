import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import { ApiKeysService } from "@modules/domain/api-keys"
import { EventsService } from "@modules/domain/events"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import { AgentAccountsService } from "@modules/domain/tools"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectAgentRecords, type AgentRecordsPort } from "./agent-records.port"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { InstallationChangesService } from "./installation-changes.service"
import { ModuleReadinessService } from "./module-readiness.service"
import type { InstallationView } from "./modules.contracts"
import { recordTypeTitleOf } from "./policies/record-type-title.policy"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/**
 * One customer channel that would have NO agent answering once the agent is removed: a provider connection the agent is the inbound
 * front door of, the website site that names it, or a public API key scoped to it.
 */
export interface AgentRemovalChannel {
    /** `connection` (a provider account), `website` (the hosted site) or `api_key` (a public API key). */
    readonly kind: "connection" | "website" | "api_key"
    /** The connection's display name, the site's public key, or the key's name. */
    readonly name: string
    /** The provider of a `connection` (`zalo_oa`, `telegram`); null for the other kinds. */
    readonly provider: string | null
    /** The connection id of a `connection`; null for the other kinds. */
    readonly connectionId: string | null
}

/** What removing an installed agent takes with it: the warning the owner sees before confirming. */
export interface AgentRemovalImpact {
    /** The installation asked about. */
    readonly installationId: string
    /** Its agent, or null when the installation has none. */
    readonly agentId: string | null
    /** The record types the agent owns records of, with a title and how many (most first). */
    readonly recordTypes: ReadonlyArray<{ readonly type: string; readonly title: string; readonly count: number }>
    /** Every record of the agent. */
    readonly records: number
    /** Every file the records hold. */
    readonly files: number
    /** The customer channels left with no agent answering (connections first, then the website, then the public API keys). */
    readonly channels: ReadonlyArray<AgentRemovalChannel>
}

@Injectable()
/**
 * Removes an installed agent (the uninstall): terminal, and the agent row stays as a stopped husk. Its RECORDS die with it (records.md: no
 * record without an agent): they are SOFT-deleted through the records store in the removal's own transaction (nothing is hard-deleted: links, rows and
 * files stay, so no file leaves the bucket). Its context versions and knowledge
 * stay for history; it stops at once (no customer turns, its agent is paused, its attachments
 * to the shop's connected accounts are deleted), leaves every list, and `installation_changed` tells the other capabilities. Installing
 * the role again makes a new installation. Owners and managers only; `impactOf` is the warning with counts shown before.
 */
export class AgentRemovalService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly installations: InstallationRecordsService,
        private readonly members: WorkspaceMembersService,
        private readonly agents: AgentsService,
        private readonly events: EventsService,
        private readonly changes: InstallationChangesService,
        private readonly readiness: ModuleReadinessService,
        private readonly bindings: AgentBindingsService,
        private readonly keys: ApiKeysService,
        @Optional() private readonly sites?: WebsiteSitesService,
        @Optional() private readonly abilities?: AgentAccountsService,
        @Optional() @InjectAgentRecords() private readonly records?: AgentRecordsPort,
    ) {}

    /**
     * What removing the installation takes with it: the agent's records per type and the files they hold (an installation with no agent, or
     * one already removed, takes nothing). Owners and managers, like the removal; changes nothing.
     */
    async impactOf(principalId: string, workspaceId: string, installationId: string): Promise<AgentRemovalImpact> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const current = await this.installations.find(workspaceId, installationId)
        if (current === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        const footprint =
            current.agentId === null || current.status === "removed" || this.records === undefined
                ? { types: [], records: 0, files: 0 }
                : await this.records.footprintOf(workspaceId, current.agentId)
        return {
            installationId,
            agentId: current.agentId,
            recordTypes: footprint.types.map(({ type, count }) => ({ type, title: recordTypeTitleOf(type), count })),
            records: footprint.records,
            files: footprint.files,
            channels:
                current.agentId === null || current.status === "removed"
                    ? []
                    : await this.channelsOf(workspaceId, current.agentId),
        }
    }

    /**
     * The customer channels the agent is the only front door of, read from the stores that bind a channel to an agent through their
     * services: the connections (`agent_connections`, inbound), the website site and the public API keys. The website intake is read where
     * it is composed (the api app).
     */
    private async channelsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<AgentRemovalChannel>> {
        const connections = await this.bindings.channelsWithoutOtherFrontDoor(workspaceId, agentId)
        const site = (await this.sites?.frontDoorSiteOf(workspaceId, agentId)) ?? null
        const keys = await this.keys.publicKeysOfAgent(workspaceId, agentId)
        return [
            ...connections.map(
                (connection): AgentRemovalChannel => ({
                    kind: "connection",
                    name: connection.name,
                    provider: connection.provider,
                    connectionId: connection.id,
                }),
            ),
            ...(site === null ? [] : [{ kind: "website" as const, name: site.siteKey, provider: null, connectionId: null }]),
            ...keys.map((key): AgentRemovalChannel => ({ kind: "api_key", name: key.name, provider: null, connectionId: null })),
        ]
    }

    /** Removes the installation; removing one that is already removed changes nothing. Answers the installation as it is now. */
    async remove(principalId: string, workspaceId: string, installationId: string): Promise<InstallationView> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        const current = await this.installations.find(workspaceId, installationId)
        if (current === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        if (current.status === "removed") return this.readiness.withNeeds(current)
        const files = await this.entityManager.transaction(async (tx) => {
            // The agent's records go first, in this transaction: a failure below rolls them back with it.
            const erased =
                current.agentId === null || this.records === undefined
                    ? { records: 0, files: [] }
                    : await this.records.erase(workspaceId, current.agentId, tx)
            await this.installations.markRemoved(workspaceId, installationId, member.displayName, tx)
            if (current.agentId !== null) {
                await this.agents.setStatus(principalId, workspaceId, current.agentId, false, tx)
            }
            await this.changes.announce({ workspaceId, installationId, force: false }, tx)
            return erased.files
        })
        // The objects of the erased records leave the bucket only now that the removal committed (a rollback keeps the records AND their files).
        if (files.length > 0) await this.records?.removeFiles(files)
        // A removed agent holds no right on any connected account: its attachments go with it (a paused agent keeps its own).
        if (current.agentId !== null) await this.abilities?.detachAgent(workspaceId, current.agentId)
        await this.events.record({
            workspaceId,
            kind: "module.removed",
            actor: member.displayName,
            summary: `${member.displayName}: ${current.moduleKey}${current.isMulti ? " - " + current.name : ""}`,
        })
        const removed = await this.installations.find(workspaceId, installationId)
        if (removed === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        return this.readiness.withNeeds(removed)
    }
}
