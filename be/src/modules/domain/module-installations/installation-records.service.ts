import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { sql } from "@modules/platform/database"
import type {
    InstallationMode,
    InstallationRecord,
    InstallationSettings,
    InstallationStatus,
    InstanceName,
    NewInstallation,
    OpenclawInstallation,
    OptionalAgentSyncStatus,
    OptionalRowId,
    OptionalInstallationRecord,
    RequirementFacts,
} from "./module-installations.contracts"
import type { IdRow, SyncStatusRow } from "./persistence/module-installations.rows"
import {
    ACTIVATE_VERSION,
    FIND_FIRST_OF_MODULE,
    FIND_INSTALLATION,
    FIND_INSTALLATION_BY_ID,
    FIND_OF_AGENT,
    FIND_REQUIREMENT_FACTS,
    FIND_SYNC_STATUS,
    INSERT_INSTALLATION,
    LIST_BOUND_AGENTS,
    LIST_INSTALLATIONS,
    LIST_INSTANCE_NAMES,
    LIST_ON_OPENCLAW,
    RENAME_INSTALLATION,
    SAVE_SETTINGS,
    SET_LIVE,
    SET_OPERATING_MODE,
} from "./persistence/module-installations.sql"

const UNIQUE_VIOLATION = "23505"

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION

/** What a write on an installation did: it changed the row, found no such row, or hit a unique index. */
export type InstallationWrite = "done" | "missing" | "taken"

@Injectable()
/** The installed agents of the workspaces: the only owner of the module_installations table. */
export class InstallationRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every installation of a workspace, oldest first. */
    list(workspaceId: string): Promise<ReadonlyArray<InstallationRecord>> {
        return this.entityManager.query<Array<InstallationRecord>>(LIST_INSTALLATIONS, [workspaceId])
    }

    /** One installation of a workspace by id; null when there is none. */
    async find(workspaceId: string, installationId: string): Promise<OptionalInstallationRecord> {
        const [row] = await this.entityManager.query<Array<InstallationRecord>>(FIND_INSTALLATION, [
            workspaceId,
            installationId,
        ])
        return row ?? null
    }

    /** One installation by id, whatever its workspace; null when there is none. */
    async findById(installationId: string): Promise<OptionalInstallationRecord> {
        const [row] = await this.entityManager.query<Array<InstallationRecord>>(FIND_INSTALLATION_BY_ID, [
            installationId,
        ])
        return row ?? null
    }

    /** The oldest installation of a module in a workspace; null when the module is not installed. */
    async firstOfModule(workspaceId: string, moduleKey: string): Promise<OptionalInstallationRecord> {
        const [row] = await this.entityManager.query<Array<InstallationRecord>>(FIND_FIRST_OF_MODULE, [
            workspaceId,
            moduleKey,
        ])
        return row ?? null
    }

    /** The installation that owns an agent; null when the agent drives none. */
    async ofAgent(workspaceId: string, agentId: string): Promise<OptionalInstallationRecord> {
        const [row] = await this.entityManager.query<Array<InstallationRecord>>(FIND_OF_AGENT, [workspaceId, agentId])
        return row ?? null
    }

    /** The labels of the instances of a type, except one when `exceptId` names it. */
    instanceNames(
        workspaceId: string,
        moduleKey: string,
        exceptId: OptionalRowId,
    ): Promise<ReadonlyArray<InstanceName>> {
        return this.entityManager.query<Array<InstanceName>>(LIST_INSTANCE_NAMES, [workspaceId, moduleKey, exceptId])
    }

    /** The ids of the agents of a workspace that an installation already drives. */
    async boundAgentIds(workspaceId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<IdRow>>(LIST_BOUND_AGENTS, [workspaceId])
        return rows.map((row) => row.id)
    }

    /** Installs a module in setup and answers the id of the installation; null when its label or its agent is taken. */
    async insert(installation: NewInstallation): Promise<OptionalRowId> {
        const rows = await this.entityManager
            .query<Array<IdRow>>(INSERT_INSTALLATION, [
                installation.workspaceId,
                installation.moduleKey,
                installation.name,
                installation.agentId,
                installation.operatingMode,
            ])
            .catch((cause: unknown) => {
                if (isUniqueViolation(cause)) return []
                throw cause
            })
        return rows[0]?.id ?? null
    }

    /** Renames an instance. */
    rename(workspaceId: string, installationId: string, name: string): Promise<InstallationWrite> {
        return this.write(RENAME_INSTALLATION, [installationId, workspaceId, name])
    }

    /** Sets how the agent runs. */
    setOperatingMode(workspaceId: string, installationId: string, mode: InstallationMode): Promise<InstallationWrite> {
        return this.write(SET_OPERATING_MODE, [installationId, workspaceId, mode])
    }

    /** Switches the agent live or paused. */
    setLive(workspaceId: string, installationId: string, live: boolean): Promise<InstallationWrite> {
        return this.write(SET_LIVE, [installationId, workspaceId, live, live ? "live" : "paused"])
    }

    /** Replaces the settings of an installation. */
    saveSettings(
        workspaceId: string,
        installationId: string,
        settings: InstallationSettings,
    ): Promise<InstallationWrite> {
        return this.write(SAVE_SETTINGS, [installationId, workspaceId, JSON.stringify(settings)])
    }

    /** Points the installation at a freshly applied version. */
    activateVersion(
        workspaceId: string,
        installationId: string,
        versionId: string,
        status: InstallationStatus,
    ): Promise<InstallationWrite> {
        return this.write(ACTIVATE_VERSION, [installationId, workspaceId, versionId, status])
    }

    /** Where the OpenClaw copy of the agent of an installation stands; null when the installation is not of the workspace. */
    async syncStatus(workspaceId: string, installationId: string): Promise<OptionalAgentSyncStatus> {
        const [row] = await this.entityManager.query<Array<SyncStatusRow>>(FIND_SYNC_STATUS, [
            workspaceId,
            installationId,
        ])
        if (row === undefined) return null
        return { ...row, state: row.state === "ok" || row.state === "error" ? row.state : "none" }
    }

    /** What the workspace has for the requirements of a module: connected providers and head counts. */
    async requirementFacts(workspaceId: string): Promise<RequirementFacts> {
        const [row] = await this.entityManager.query<[RequirementFacts]>(FIND_REQUIREMENT_FACTS, [workspaceId])
        return row
    }

    /** Up to `limit` installations that run on OpenClaw, of one workspace or of all when `workspaceId` is null. */
    onOpenclaw(workspaceId: OptionalRowId, limit: number): Promise<ReadonlyArray<OpenclawInstallation>> {
        return this.entityManager.query<Array<OpenclawInstallation>>(LIST_ON_OPENCLAW, [workspaceId, limit])
    }

    private async write(statement: ReturnType<typeof sql>, parameters: Array<unknown>): Promise<InstallationWrite> {
        const rows = await this.entityManager.query<Array<IdRow>>(statement, parameters).catch((cause: unknown) => {
            if (isUniqueViolation(cause)) return null
            throw cause
        })
        if (rows === null) return "taken"
        return rows.length === 0 ? "missing" : "done"
    }
}
