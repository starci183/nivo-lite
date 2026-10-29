import { Injectable } from "@nestjs/common"
import { Not, IsNull } from "typeorm"
import type { EntityManager, SelectQueryBuilder, UpdateResult } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { ModuleContextVersionEntity } from "@modules/domain/module-context-versions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AgentSyncStatus,
    InstallationMode,
    InstallationRecord,
    InstallationSettings,
    InstallationStatus,
    InstanceName,
    NewInstallation,
    OpenclawInstallation,
    RecordInstallation,
    OptionalAgentSyncStatus,
    OptionalRowId,
    OptionalInstallationRecord,
    OptionalInstallationStatus,
    RequirementFacts,
} from "./module-installations.contracts"
import { ModuleInstallationEntity } from "./persistence/entities"

const UNIQUE_VIOLATION = "23505"
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Tables that hold records naming an installation: the owner of a record id is found in one of them. */
const RECORD_TABLES: ReadonlyArray<string> = [
    "public.work_items",
    "public.agent_conversations",
    "public.bookings",
    "public.lead_flows",
    "public.leads",
]

/** How many installations of a workspace are listed at once. */
const INSTALLATIONS_LIMIT = 200

/** How many instance labels, bound agents or workspaces are read at once. */
const SMALL_LIST_LIMIT = 1000

/** How many connected providers are read at once. */
const PROVIDERS_LIMIT = 200

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION

/** The status a switch leaves: paused when off; when on, live, or waiting for a connection a required role still lacks. */
const liveStatusOf = (live: boolean, waitingForConnection: boolean): InstallationStatus => {
    if (!live) return "paused"
    return waitingForConnection ? "needs_connection" : "live"
}

/** The installation with its agent and its active version as the read query selects them. */
interface InstallationProjection extends Omit<InstallationRecord, "createdAt"> {
    /** When it was installed. */
    readonly createdAt: Date
}

/** The OpenClaw copy of an installation as the status query selects it. */
interface SyncProjection {
    /** The stored sync status text; null when the installation has no copy yet. */
    readonly state: string | null
    /** The context version OpenClaw holds. */
    readonly syncedVersion: number | null
    /** The context version that is active in the database. */
    readonly activeVersion: number | null
    /** When the copy was last checked. */
    readonly checkedAt: Date | null
    /** The last failure. */
    readonly error: string | null
}

const toRecord = (row: InstallationProjection): InstallationRecord => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
})

/** What a write on an installation did: it changed the row, found no such row, or hit a unique index. */
export type InstallationWrite = "done" | "missing" | "taken"

@Injectable()
/** The installed agents of the workspaces: the only owner of the module_installations table. */
export class InstallationRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every installation of a workspace, oldest first. */
    async list(workspaceId: string): Promise<ReadonlyArray<InstallationRecord>> {
        const rows = await this.projection()
            .where("i.workspaceId = :workspaceId AND i.status <> 'removed'", { workspaceId })
            .orderBy("i.createdAt", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(INSTALLATIONS_LIMIT)
            .getRawMany<InstallationProjection>()
        return rows.map(toRecord)
    }

    /**
     * The installation that owns a work item, conversation, booking, lead flow or lead of the workspace.
     * Null when the id is not one of those rows, or the row names no installation.
     */
    async installationOfRecord(workspaceId: string, recordId: string): Promise<RecordInstallation> {
        if (!RECORD_ID.test(recordId)) return { installationId: null }
        const found = await Promise.all(
            RECORD_TABLES.map((table) =>
                this.entityManager
                    .createQueryBuilder()
                    .select("t.installation_id", "installationId")
                    .from(table, "t")
                    .where("t.workspace_id = :workspaceId AND t.id = :recordId", { workspaceId, recordId })
                    .andWhere("t.installation_id IS NOT NULL")
                    .limit(1)
                    .getRawOne<RecordInstallation>(),
            ),
        )
        return { installationId: found.find((row) => row !== undefined)?.installationId ?? null }
    }

    /** One installation of a workspace by id; null when there is none. */
    async find(workspaceId: string, installationId: string): Promise<OptionalInstallationRecord> {
        const row = await this.projection()
            .where("i.workspaceId = :workspaceId AND i.id = :installationId", { workspaceId, installationId })
            .limit(1)
            .getRawOne<InstallationProjection>()
        return row === undefined ? null : toRecord(row)
    }

    /** One installation by id, whatever its workspace; null when there is none. */
    async findById(installationId: string): Promise<OptionalInstallationRecord> {
        const row = await this.projection()
            .where("i.id = :installationId", { installationId })
            .limit(1)
            .getRawOne<InstallationProjection>()
        return row === undefined ? null : toRecord(row)
    }

    /** The oldest installation of a module in a workspace; null when the module is not installed. */
    async firstOfModule(workspaceId: string, moduleKey: string): Promise<OptionalInstallationRecord> {
        const row = await this.projection()
            .where("i.workspaceId = :workspaceId AND i.moduleKey = :moduleKey AND i.status <> 'removed'", {
                workspaceId,
                moduleKey,
            })
            .orderBy("i.createdAt", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(1)
            .getRawOne<InstallationProjection>()
        return row === undefined ? null : toRecord(row)
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
        const row = await this.projection()
            .where("i.workspaceId = :workspaceId AND i.agentId = :agentId", { workspaceId, agentId })
            .limit(1)
            .getRawOne<InstallationProjection>()
        return row === undefined ? null : toRecord(row)
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
            this.entityManager.update(
                ModuleInstallationEntity,
                { id: installationId, workspaceId },
                { settings: settings as QueryDeepPartialEntity<InstallationSettings> },
            ),
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
        const [row] = settled.raw as Array<{ status: InstallationStatus }>
        return row?.status ?? null
    }

    /** Where the OpenClaw copy of the agent of an installation stands; null when the installation is not of the workspace. */
    async syncStatus(workspaceId: string, installationId: string): Promise<OptionalAgentSyncStatus> {
        const row = await this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .leftJoin(ModuleContextVersionEntity, "v", "v.id = i.activeContextVersionId")
            .leftJoin("openclaw_agent_sync", "s", "s.installation_id = i.id")
            .select("s.status", "state")
            .addSelect("s.context_version", "syncedVersion")
            .addSelect("v.version", "activeVersion")
            .addSelect("s.checked_at", "checkedAt")
            .addSelect("s.error", "error")
            .where("i.workspaceId = :workspaceId AND i.id = :installationId", { workspaceId, installationId })
            .limit(1)
            .getRawOne<SyncProjection>()
        if (row === undefined) return null
        const status: AgentSyncStatus = {
            state: row.state === "ok" || row.state === "error" ? row.state : "none",
            syncedVersion: row.syncedVersion,
            activeVersion: row.activeVersion,
            checkedAt: row.checkedAt === null ? null : row.checkedAt.toISOString(),
            error: row.error,
        }
        return status
    }

    /** What the workspace has for the requirements of a module: connected providers and head counts. */
    async requirementFacts(workspaceId: string): Promise<RequirementFacts> {
        const [providers, chatAgents, staff, members] = await Promise.all([
            this.entityManager
                .createQueryBuilder()
                .select("c.provider", "provider")
                .distinct(true)
                .from("public.connections", "c")
                .where("c.workspace_id = :workspaceId AND c.status <> 'disconnected'", { workspaceId })
                .limit(PROVIDERS_LIMIT)
                .getRawMany<{ provider: string }>(),
            this.entityManager
                .createQueryBuilder()
                .select("count(*)::int", "total")
                .from("public.agents", "a")
                .where("a.workspace_id = :workspaceId AND a.module IN ('chatbot', 'booking') AND a.status = 'active'", {
                    workspaceId,
                })
                .getRawOne<{ total: number }>(),
            this.entityManager
                .createQueryBuilder()
                .select("count(*)::int", "total")
                .from("public.staff", "s")
                .where("s.workspace_id = :workspaceId AND s.active", { workspaceId })
                .getRawOne<{ total: number }>(),
            this.entityManager
                .createQueryBuilder()
                .select("count(*)::int", "total")
                .from("public.workspace_members", "m")
                .where("m.workspace_id = :workspaceId AND m.status = 'active'", { workspaceId })
                .getRawOne<{ total: number }>(),
        ])
        return {
            providers: providers.map((row) => row.provider),
            chatAgents: chatAgents?.total ?? 0,
            staff: staff?.total ?? 0,
            members: members?.total ?? 0,
        }
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

    /** The installation with its agent and its active context version, ready for a where clause. */
    private projection(): SelectQueryBuilder<ModuleInstallationEntity> {
        return this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .leftJoin("agents", "a", "a.id = i.agentId")
            .leftJoin(ModuleContextVersionEntity, "v", "v.id = i.activeContextVersionId")
            .select("i.id", "id")
            .addSelect("i.workspaceId", "workspaceId")
            .addSelect("i.moduleKey", "moduleKey")
            .addSelect("i.name", "name")
            .addSelect("i.isMulti", "isMulti")
            .addSelect("i.agentId", "agentId")
            .addSelect("COALESCE(a.name, '')", "agentName")
            .addSelect("COALESCE(a.handle, i.module_key)", "agentHandle")
            .addSelect("a.avatar_url", "agentAvatarUrl")
            .addSelect("i.status", "status")
            .addSelect("i.operatingMode", "operatingMode")
            .addSelect("i.liveEnabled", "liveEnabled")
            .addSelect("i.activeContextVersionId", "activeContextVersionId")
            .addSelect("v.version", "activeVersion")
            .addSelect("i.settings", "settings")
            .addSelect("i.createdAt", "createdAt")
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
