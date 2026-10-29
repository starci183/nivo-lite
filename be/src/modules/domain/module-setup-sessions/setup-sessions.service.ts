import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    NewSetupSession,
    OptionalSetupSessionRecord,
    SetupRevisionRecord,
    SetupSessionChange,
    SetupSessionRecord,
} from "./module-setup-sessions.contracts"
import { ModuleSetupSessionEntity } from "./persistence/entities"

/** How many revisions of one installation are listed at once. */
const REVISIONS_LIMIT = 100

/** Maps a stored session to its contract. */
const toRecord = (row: ModuleSetupSessionEntity): SetupSessionRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    installationId: row.installationId,
    revision: row.revision,
    status: row.status,
    draft: row.draftSnapshot,
    gateEvidence: row.gateEvidence,
    createdAt: row.createdAt.toISOString(),
})

/** The columns the saving update answers. */
interface SavedRow {
    /** The session. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The installation. */
    readonly installation_id: string
    /** The revision. */
    readonly revision: number
    /** Where it stands. */
    readonly status: SetupSessionRecord["status"]
    /** The draft. */
    readonly draft_snapshot: SetupSessionRecord["draft"]
    /** The evidence per gate. */
    readonly gate_evidence: SetupSessionRecord["gateEvidence"]
    /** When it was opened. */
    readonly created_at: Date
}

@Injectable()
/** The draft sessions of the setup chat: the only owner of the module_setup_sessions table. */
export class SetupSessionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest revision of an installation; null before the chat was opened. */
    async latest(installationId: string): Promise<OptionalSetupSessionRecord> {
        const row = await this.entityManager.findOne(ModuleSetupSessionEntity, {
            where: { installationId },
            order: { revision: "DESC" },
        })
        return row === null ? null : toRecord(row)
    }

    /** One session of the workspace by id; null when there is none. */
    async find(workspaceId: string, sessionId: string): Promise<OptionalSetupSessionRecord> {
        const row = await this.entityManager.findOne(ModuleSetupSessionEntity, {
            where: { id: sessionId, workspaceId },
        })
        return row === null ? null : toRecord(row)
    }

    /** Every revision of an installation, oldest first. */
    async revisions(installationId: string): Promise<ReadonlyArray<SetupRevisionRecord>> {
        const rows = await this.entityManager.find(ModuleSetupSessionEntity, {
            select: { id: true, revision: true, status: true },
            where: { installationId },
            order: { revision: "ASC" },
            take: REVISIONS_LIMIT,
        })
        return rows.map((row) => ({ id: row.id, revision: row.revision, status: row.status }))
    }

    /** Opens the next draft; null when another call opened the same revision first. */
    async open(session: NewSetupSession): Promise<OptionalSetupSessionRecord> {
        const row = await this.entityManager
            .save(ModuleSetupSessionEntity, {
                workspaceId: session.workspaceId,
                installationId: session.installationId,
                revision: session.revision,
                draftSnapshot: session.draft,
                gateEvidence: session.gateEvidence,
            })
            .catch((cause: unknown) => {
                if (isUniqueViolation(cause)) return null
                throw cause
            })
        return row === null ? null : toRecord(row)
    }

    /** Stores the draft and the gate evidence on the open draft; null when the session is not a draft any more. */
    async save(sessionId: string, change: SetupSessionChange): Promise<OptionalSetupSessionRecord> {
        const saved = await this.entityManager
            .createQueryBuilder(ModuleSetupSessionEntity, "m")
            .update()
            .set({ draftSnapshot: change.draft, gateEvidence: change.gateEvidence })
            .where({ id: sessionId, status: "draft" })
            .returning("*")
            .execute()
        const [row] = saved.raw as Array<SavedRow>
        if (row === undefined) return null
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            installationId: row.installation_id,
            revision: row.revision,
            status: row.status,
            draft: row.draft_snapshot,
            gateEvidence: row.gate_evidence,
            createdAt: row.created_at.toISOString(),
        }
    }

    /** Closes the draft as applied. */
    async close(sessionId: string): Promise<void> {
        await this.entityManager.update(ModuleSetupSessionEntity, { id: sessionId }, { status: "applied" })
    }

    /** Takes one fact out of the open draft of an installation; a closed session is left as it is. */
    async dropFact(installationId: string, factKey: string): Promise<void> {
        const latest = await this.latest(installationId)
        if (latest?.status !== "draft") return
        const facts = latest.draft.facts.filter((fact) => fact.key !== factKey)
        if (facts.length === latest.draft.facts.length) return
        await this.save(latest.id, { draft: { ...latest.draft, facts }, gateEvidence: latest.gateEvidence })
    }
}

const UNIQUE_VIOLATION = "23505"

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION
