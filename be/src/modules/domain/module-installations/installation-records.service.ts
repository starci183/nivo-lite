import { Injectable } from "@nestjs/common"
import { Not, IsNull } from "typeorm"
import type { EntityManager, UpdateResult } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type {
    InstallationMode,
    InstallationRecord,
    InstallationSettings,
    InstallationStatus,
    InstanceName,
    NewInstallation,
    OpenclawInstallation,
    OptionalRowId,
    OptionalInstallationRecord,
    OptionalInstallationStatus,
} from "./module-installations.contracts"
import { ModuleInstallationEntity } from "./persistence/entities"

const UNIQUE_VIOLATION = "23505"

/** How many installations of a workspace are listed at once. */
const INSTALLATIONS_LIMIT = 200

/** How many instance labels, bound agents or workspaces are read at once. */
const SMALL_LIST_LIMIT = 1000

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION

/** The status a switch leaves: paused when off; when on, live, or waiting for a connection a required role still lacks. */
const liveStatusOf = (live: boolean, waitingForConnection: boolean): InstallationStatus => {
    if (!live) return "paused"
    return waitingForConnection ? "needs_connection" : "live"
}

const toRecord = (row: ModuleInstallationEntity): InstallationRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    moduleKey: row.moduleKey,
    name: row.name,
    isMulti: row.isMulti,
    agentId: row.agentId,
    status: row.status,
    operatingMode: row.operatingMode,
    liveEnabled: row.liveEnabled,
    activeContextVersionId: row.activeContextVersionId,
    settings: row.settings,
    createdAt: row.createdAt.toISOString(),
})

/** The installations in the order every list reads them: oldest first, ties by id. */
const isSettledRow = (value: unknown): value is { readonly status: InstallationStatus } =>
    isRecord(value) && typeof value.status === "string"

const OLDEST_FIRST = { createdAt: "ASC", id: "ASC" } as const

/** What a write on an installation did: it changed the row, found no such row, or hit a unique index. */
export type InstallationWrite = "done" | "missing" | "taken"

@Injectable()
/** The installed agents of the workspaces: the only owner of the module_installations table. */
export class InstallationRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every installation of a workspace, oldest first. */
    async list(workspaceId: string): Promise<ReadonlyArray<InstallationRecord>> {
        const rows = await this.entityManager.find(ModuleInstallationEntity, {
            where: { workspaceId, status: Not("removed") },
            order: OLDEST_FIRST,
            take: INSTALLATIONS_LIMIT,
        })
        return rows.map(toRecord)
    }

    /** One installation of a workspace by id; null when there is none. */
    async find(workspaceId: string, installationId: string): Promise<OptionalInstallationRecord> {
        const row = await this.entityManager.findOne(ModuleInstallationEntity, {
            where: { workspaceId, id: installationId },
        })
        return row === null ? null : toRecord(row)
    }

    /** One installation by id, whatever its workspace; null when there is none. */
    async findById(installationId: string): Promise<OptionalInstallationRecord> {
        const row = await this.entityManager.findOne(ModuleInstallationEntity, { where: { id: installationId } })
        return row === null ? null : toRecord(row)
    }

    /** The oldest installation of a module in a workspace; null when the module is not installed. */
    async firstOfModule(workspaceId: string, moduleKey: string): Promise<OptionalInstallationRecord> {
        const row = await this.entityManager.findOne(ModuleInstallationEntity, {
            where: { workspaceId, moduleKey, status: Not("removed") },
            order: OLDEST_FIRST,
        })
        return row === null ? null : toRecord(row)
    }

    /** The workspaces where a module is installed, whatever their state. */
    async workspacesOf(moduleKey: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .select("i.workspaceId", "id")
            .distinct(true)
            .where("i.moduleKey = :moduleKey AND i.status <> 'removed'", { moduleKey })
            .orderBy("i.workspaceId", "ASC")
            .limit(SMALL_LIST_LIMIT)
            .getRawMany<{ id: string }>()
        return rows.map((row) => row.id)
    }

    /** The installation that owns an agent; null when the agent drives none. */
    async ofAgent(workspaceId: string, agentId: string): Promise<OptionalInstallationRecord> {
        const row = await this.entityManager.findOne(ModuleInstallationEntity, { where: { workspaceId, agentId } })
        return row === null ? null : toRecord(row)
    }

    /** The labels of the instances of a type, except one when `exceptId` names it. */
    async instanceNames(
        workspaceId: string,
        moduleKey: string,
        exceptId: OptionalRowId,
    ): Promise<ReadonlyArray<InstanceName>> {
        const rows = await this.entityManager.find(ModuleInstallationEntity, {
            select: { id: true, name: true },
            where: {
                workspaceId,
                moduleKey,
                status: Not("removed"),
                ...(exceptId === null ? {} : { id: Not(exceptId) }),
            },
            take: SMALL_LIST_LIMIT,
        })
        return rows.map((row) => ({ id: row.id, name: row.name }))
    }

    /** The ids of the agents of a workspace that an installation already drives. */
    async boundAgentIds(workspaceId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.find(ModuleInstallationEntity, {
            select: { agentId: true },
            where: { workspaceId, agentId: Not(IsNull()) },
            take: SMALL_LIST_LIMIT,
        })
        return rows.flatMap((row) => (row.agentId === null ? [] : [row.agentId]))
    }

    /** Installs a module in setup and answers the id of the installation; null when its label or its agent is taken. */
    async insert(installation: NewInstallation): Promise<OptionalRowId> {
        const result = await this.entityManager
            .insert(ModuleInstallationEntity, {
                workspaceId: installation.workspaceId,
                moduleKey: installation.moduleKey,
                name: installation.name,
                agentId: installation.agentId,
                status: "setup",
                operatingMode: installation.operatingMode,
            })
            .catch((cause: unknown) => {
                if (isUniqueViolation(cause)) return null
                throw cause
            })
        const identifier: { id?: string } | undefined = result?.identifiers[0]
        return identifier?.id ?? null
    }

    /** Renames an instance. */
    rename(workspaceId: string, installationId: string, name: string): Promise<InstallationWrite> {
        return this.write(() =>
            this.entityManager.update(ModuleInstallationEntity, { id: installationId, workspaceId }, { name }),
        )
    }

    /** Sets how the agent runs. */
    setOperatingMode(workspaceId: string, installationId: string, mode: InstallationMode): Promise<InstallationWrite> {
        return this.write(() =>
            this.entityManager.update(
                ModuleInstallationEntity,
                { id: installationId, workspaceId },
                { operatingMode: mode },
            ),
        )
    }

    /**
     * Switches the agent live or paused; a live agent still waiting for a required connection is recorded as
     * `needs_connection`. Going live needs an applied context version: the guard is part of the update criteria, so no caller
     * can switch on an agent that has nothing confirmed to run on.
     */
    setLive(
        workspaceId: string,
        installationId: string,
        live: boolean,
        waitingForConnection: boolean,
        manager: EntityManager = this.entityManager,
    ): Promise<InstallationWrite> {
        return this.write(() =>
            manager.update(
                ModuleInstallationEntity,
                live
                    ? { id: installationId, workspaceId, activeContextVersionId: Not(IsNull()) }
                    : { id: installationId, workspaceId },
                { liveEnabled: live, status: liveStatusOf(live, waitingForConnection) },
            ),
        )
    }

    /** Removes an installation for good, inside the caller's transaction; "missing" when it is not of the workspace or is already removed. */
    markRemoved(
        workspaceId: string,
        installationId: string,
        removedBy: string,
        manager: EntityManager,
    ): Promise<InstallationWrite> {
        return this.write(() =>
            manager.update(
                ModuleInstallationEntity,
                { id: installationId, workspaceId, status: Not("removed") },
                { status: "removed", liveEnabled: false, removedAt: () => "now()", removedBy },
            ),
        )
    }

    /** Replaces the settings of an installation. */
    saveSettings(
        workspaceId: string,
        installationId: string,
        settings: InstallationSettings,
    ): Promise<InstallationWrite> {
        return this.write(() =>
            this.entityManager.update(ModuleInstallationEntity, { id: installationId, workspaceId }, { settings }),
        )
    }

    /** Points the installation at a freshly applied version. */
    activateVersion(
        workspaceId: string,
        installationId: string,
        versionId: string,
        status: InstallationStatus,
    ): Promise<InstallationWrite> {
        return this.write(() =>
            this.entityManager.update(
                ModuleInstallationEntity,
                { id: installationId, workspaceId },
                { activeContextVersionId: versionId, status },
            ),
        )
    }

    /**
     * Moves an installation by whether the connections its module requires are ready: ready or live without them waits for a
     * connection (`needs_connection`), waiting with them is live again when the owner had switched it on, else ready; any other status is left as it is. Answers the new
     * status, or null when nothing moved.
     */
    async settleConnection(
        workspaceId: string,
        installationId: string,
        ready: boolean,
    ): Promise<OptionalInstallationStatus> {
        const settled = await this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .update()
            .set({
                status: () =>
                    "CASE WHEN NOT :ready::boolean THEN 'needs_connection' WHEN live_enabled THEN 'live' ELSE 'ready' END",
            })
            .where("id = :installationId AND workspace_id = :workspaceId", { installationId, workspaceId })
            .andWhere(
                "((NOT :ready::boolean AND status IN ('ready', 'live')) OR (:ready::boolean AND status = 'needs_connection'))",
            )
            .setParameter("ready", ready)
            .returning("status")
            .execute()
        return [settled.raw].flat().find(isSettledRow)?.status ?? null
    }

    /** Up to `limit` installations that run on OpenClaw, of one workspace or of all when `workspaceId` is null. */
    onOpenclaw(workspaceId: OptionalRowId, limit: number): Promise<ReadonlyArray<OpenclawInstallation>> {
        const query = this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .select("i.id", "id")
            .addSelect("i.workspaceId", "workspaceId")
            .where("i.status <> 'removed'")
            .andWhere("COALESCE(i.settings ->> 'processor', '') <> 'nivo'")
        if (workspaceId !== null) query.andWhere("i.workspaceId = :workspaceId", { workspaceId })
        return query
            .orderBy("i.createdAt", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(limit)
            .getRawMany<OpenclawInstallation>()
    }

    private async write(run: () => Promise<UpdateResult>): Promise<InstallationWrite> {
        const result = await run().catch((cause: unknown) => {
            if (isUniqueViolation(cause)) return null
            throw cause
        })
        if (result === null) return "taken"
        return (result.affected ?? 0) === 0 ? "missing" : "done"
    }
}
