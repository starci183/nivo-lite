import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentIdentityService, AgentsService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { EventsService } from "@modules/domain/events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type {
    AgentSyncStatus,
    InstallationMode,
    InstallationRecord,
    InstallationWrite,
    RecordInstallation,
    RequirementFacts,
} from "@modules/domain/module-installations"
import { InstallationChangesService } from "./installation-changes.service"
import { InstallationFactsService } from "./installation-facts.service"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { InstallRequest, InstallResult } from "./module-installs.contracts"
import { ModuleReadinessService } from "./module-readiness.service"
import type { InstallationView, ModuleDefinition } from "./modules.contracts"
import { ModulesService } from "./modules.service"
import { RecordInstallationService } from "./record-installation.service"
import {
    AGENT_NAME_LIMITS,
    agentNameOf,
    cleanInstanceName,
    defaultRulesOf,
    freeHandle,
    instanceNameKey,
    nextInstanceName,
    settingOf,
    withSetting,
} from "./policies/instance.policy"
import type { SettingValue } from "./policies/instance.policy"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

const expectWritten = (written: InstallationWrite): void => {
    if (written === "taken") throw new ModulesError({ code: ModulesErrorCode.InstanceNameTaken })
    if (written === "missing") throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
}

@Injectable()
/**
 * The lifecycle of the installed agents of a workspace: installing a module (its agent, its default authority rules, its OpenClaw copy),
 * adding an instance of a multi-instance type, renaming, the operating mode, the live switch and the settings. Reads are open to every
 * member; every change is for owners and managers.
 */
export class ModuleInstallService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly installations: InstallationRecordsService,
        private readonly members: WorkspaceMembersService,
        private readonly catalog: ModulesService,
        private readonly agents: AgentsService,
        private readonly identity: AgentIdentityService,
        private readonly rules: AuthorityRulesService,
        private readonly events: EventsService,
        private readonly changes: InstallationChangesService,
        private readonly facts: InstallationFactsService,
        private readonly recordOwners: RecordInstallationService,
        private readonly readiness: ModuleReadinessService,
    ) {}

    /** Every installation of the workspace, oldest first; any member may read. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<InstallationView>> {
        await this.members.require(principalId, workspaceId)
        const records = await this.installations.list(workspaceId)
        return Promise.all(records.map((record) => this.readiness.withNeeds(record)))
    }

    /** One installation of the workspace; any member may read. */
    async get(principalId: string, workspaceId: string, installationId: string): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId)
        return this.viewOf(workspaceId, installationId)
    }

    /** The installation that owns a record of the workspace; any member may read. Null when none says. */
    async installationOfRecord(
        principalId: string,
        workspaceId: string,
        recordId: string,
    ): Promise<RecordInstallation> {
        await this.members.require(principalId, workspaceId)
        return this.recordOwners.installationOfRecord(workspaceId, recordId)
    }

    /**
     * Installs a module: its agent (reused when the workspace already has an unbound one, except for an added instance), the installation,
     * its default authority rules (never overwriting what the owner already set) and the sync of its OpenClaw copy. Without `newInstance`
     * the call is idempotent and answers the first installation of the type.
     */
    async install(principalId: string, request: InstallRequest): Promise<InstallResult> {
        const member = await this.members.require(principalId, request.workspaceId, GOVERNORS)
        const module = await this.catalog.find(request.moduleKey)
        const wanted = request.name === null ? null : cleanInstanceName(request.name)
        if (request.name !== null && wanted === null) {
            throw new ModulesError({ code: ModulesErrorCode.InstanceNameInvalid })
        }
        if (request.newInstance && !module.multiInstance) {
            throw new ModulesError({ code: ModulesErrorCode.SingleInstanceOnly })
        }
        const existing = request.newInstance
            ? null
            : await this.installations.firstOfModule(request.workspaceId, module.key)
        const made =
            existing === null
                ? await this.create(principalId, member, module, request, wanted)
                : { installationId: existing.id, agentId: existing.agentId, created: false }
        await this.rules.seedDefaults(request.workspaceId, module.key, defaultRulesOf(module))
        await this.changes.announceNow({
            workspaceId: request.workspaceId,
            installationId: made.installationId,
            force: true,
        })
        return made
    }

    /** Renames an instance: its label in lists, the chrome and Office; unique per type in the workspace, case-insensitive. */
    async rename(
        principalId: string,
        workspaceId: string,
        installationId: string,
        name: string,
    ): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const clean = cleanInstanceName(name)
        if (clean === null) throw new ModulesError({ code: ModulesErrorCode.InstanceNameInvalid })
        const current = await this.requireActive(workspaceId, installationId)
        const siblings = await this.installations.instanceNames(workspaceId, current.moduleKey, current.id)
        if (siblings.some((other) => instanceNameKey(other.name) === instanceNameKey(clean))) {
            throw new ModulesError({ code: ModulesErrorCode.InstanceNameTaken })
        }
        expectWritten(await this.installations.rename(workspaceId, installationId, clean))
        return this.viewOf(workspaceId, installationId)
    }

    /** Sets how an agent runs: autopilot applies the authority rules as configured, assist downgrades every automatic action to a question. */
    async setOperatingMode(
        principalId: string,
        workspaceId: string,
        installationId: string,
        mode: InstallationMode,
    ): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        await this.requireActive(workspaceId, installationId)
        expectWritten(await this.installations.setOperatingMode(workspaceId, installationId, mode))
        return this.viewOf(workspaceId, installationId)
    }

    /**
     * Switches an agent live (it acts on channels) or paused (it stays silent); going live needs an applied context version. Going live
     * with a required connection missing records `needs_connection`, not `live`: the agent runs once the connection is there.
     */
    async setLive(
        principalId: string,
        workspaceId: string,
        installationId: string,
        live: boolean,
    ): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const current = await this.requireActive(workspaceId, installationId)
        if (live && current.activeContextVersionId === null) {
            throw new ModulesError({ code: ModulesErrorCode.NeedsVersion })
        }
        const waiting = live && (await this.readiness.needsOf(workspaceId, current.moduleKey)).length > 0
        // One transaction: the installation and its agent are switched together or not at all.
        await this.entityManager.transaction(async (tx) => {
            expectWritten(await this.installations.setLive(workspaceId, installationId, live, waiting, tx))
            if (current.agentId !== null) {
                await this.agents.setStatus(principalId, workspaceId, current.agentId, live, tx)
            }
        })
        return this.viewOf(workspaceId, installationId)
    }

    /** Renames the agent of an installation: the display name its team sees in Office and on cards. */
    async renameAgent(
        principalId: string,
        workspaceId: string,
        installationId: string,
        name: string,
    ): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const clean = agentNameOf(name)
        if (clean.length < AGENT_NAME_LIMITS.min) {
            throw new ModulesError({ code: ModulesErrorCode.AgentNameInvalid, params: AGENT_NAME_LIMITS })
        }
        const current = await this.requireActive(workspaceId, installationId)
        if (current.agentId === null) throw new ModulesError({ code: ModulesErrorCode.AgentMissing })
        await this.identity.rename(principalId, workspaceId, current.agentId, clean)
        await this.changes.announceNow({ workspaceId, installationId, force: false })
        return this.viewOf(workspaceId, installationId)
    }

    /**
     * Merges one setting into the settings of an installation: the longest a customer waits before the app answers directly
     * (`openclawTimeoutSec`) or the holding message (`holdingMessage`, empty removes it).
     */
    async saveSetting(
        principalId: string,
        workspaceId: string,
        installationId: string,
        name: string,
        value: SettingValue,
    ): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const change = settingOf(name, value)
        if (change === null) throw new ModulesError({ code: ModulesErrorCode.SettingInvalid })
        const current = await this.requireActive(workspaceId, installationId)
        expectWritten(
            await this.installations.saveSettings(workspaceId, installationId, withSetting(current.settings, change)),
        )
        return this.viewOf(workspaceId, installationId)
    }

    /** What the workspace has for the requirements of a module (connected providers, head counts); any member may look. */
    async requirementFacts(principalId: string, workspaceId: string): Promise<RequirementFacts> {
        await this.members.require(principalId, workspaceId)
        return this.facts.requirementFacts(workspaceId)
    }

    /** Where the OpenClaw copy of the agent of an installation stands; any member may look. */
    async syncStatus(principalId: string, workspaceId: string, installationId: string): Promise<AgentSyncStatus> {
        await this.members.require(principalId, workspaceId)
        const status = await this.facts.syncStatus(workspaceId, installationId)
        if (status === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        return status
    }

    /** The installation of the workspace with what it still needs connected. */
    private async viewOf(workspaceId: string, installationId: string): Promise<InstallationView> {
        return this.readiness.withNeeds(await this.require(workspaceId, installationId))
    }

    /** The installation of the workspace, refused when it was removed: a removed agent only keeps its history. */
    private async requireActive(workspaceId: string, installationId: string): Promise<InstallationRecord> {
        const found = await this.require(workspaceId, installationId)
        if (found.status === "removed") throw new ModulesError({ code: ModulesErrorCode.InstallationRemoved })
        return found
    }

    private async require(workspaceId: string, installationId: string): Promise<InstallationRecord> {
        const found = await this.installations.find(workspaceId, installationId)
        if (found === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        return found
    }

    private async create(
        principalId: string,
        member: WorkspaceMember,
        module: ModuleDefinition,
        request: InstallRequest,
        wanted: string | null,
    ): Promise<InstallResult> {
        const { workspaceId, locale } = request
        const siblings = await this.installations.instanceNames(workspaceId, module.key, null)
        const taken = siblings.map((sibling) => sibling.name)
        const typeName = module.name[locale]
        const name = wanted ?? nextInstanceName(typeName, taken)
        if (taken.some((other) => instanceNameKey(other) === instanceNameKey(name))) {
            throw new ModulesError({ code: ModulesErrorCode.InstanceNameTaken })
        }
        const reused = request.newInstance ? null : await this.unboundAgentOf(principalId, workspaceId, module.key)
        const agentId =
            reused ?? (await this.createAgent(principalId, module, request, request.newInstance ? wanted : null))
        const installationId = await this.installations.insert({
            workspaceId,
            moduleKey: module.key,
            name,
            agentId,
            operatingMode: module.defaultOperatingMode,
        })
        if (installationId === null) {
            // Lost a race with another tab: the installation it created is the one (an added instance reports the name taken).
            const again = request.newInstance ? null : await this.installations.firstOfModule(workspaceId, module.key)
            if (again === null) throw new ModulesError({ code: ModulesErrorCode.InstanceNameTaken })
            return { installationId: again.id, agentId: again.agentId, created: false }
        }
        await this.events.record({
            workspaceId,
            kind: "module.installed",
            actor: member.displayName,
            summary: `${member.displayName}: ${typeName}${name === typeName ? "" : " - " + name}`,
        })
        return { installationId, agentId, created: true }
    }

    /** The oldest agent of the module that no installation drives yet (the first instance may take over a legacy agent). */
    private async unboundAgentOf(principalId: string, workspaceId: string, moduleKey: string): Promise<string | null> {
        const [candidates, bound] = await Promise.all([
            this.agents.list(principalId, workspaceId, moduleKey),
            this.installations.boundAgentIds(workspaceId),
        ])
        return candidates.find((agent) => !bound.includes(agent.id))?.id ?? null
    }

    private async createAgent(
        principalId: string,
        module: ModuleDefinition,
        request: InstallRequest,
        wanted: string | null,
    ): Promise<string> {
        const { workspaceId, locale } = request
        const used = new Set((await this.agents.list(principalId, workspaceId)).map((agent) => agent.handle))
        const created = await this.agents.create(principalId, {
            workspaceId,
            module: module.key,
            name: wanted === null ? { label: module.agent.label[locale] } : agentNameOf(wanted),
            handle: freeHandle(module.agent.handle, used),
            role: module.agent.role[locale],
            instructions: module.agent.instructions[locale],
        })
        return created.id
    }
}
