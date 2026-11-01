import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    NewSetupSession,
    OptionalSetupSessionRecord,
    SetupRevisionRecord,
    SetupSessionEdit,
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

    /** Opens the next draft; null when another call opened the same revision first. The opened row is read again for the time the database set. */
    async open(session: NewSetupSession): Promise<OptionalSetupSessionRecord> {
        const saved = await this.entityManager
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
        if (saved === null) return null
        const row = await this.entityManager.findOneOrFail(ModuleSetupSessionEntity, { where: { id: saved.id } })
        return toRecord(row)
    }

    /**
     * The one way to change the draft and the gate evidence: `next` receives them as they are now, read again inside a transaction that
     * locks the row, and answers the next ones (or null to leave them as they are). Two changes in a row both land, and a change that
     * waited on a model call merges into what the owner did meanwhile. Null when the session is not a draft any more. `next` must not
     * wait on anything slow: the row stays locked while it runs.
     */
    change(sessionId: string, next: SetupSessionEdit): Promise<OptionalSetupSessionRecord> {
        return this.entityManager.transaction(async (tx) => {
            const locked = await tx.findOne(ModuleSetupSessionEntity, {
                where: { id: sessionId, status: "draft" },
                lock: { mode: "pessimistic_write" },
            })
            if (locked === null) return null
            const current = toRecord(locked)
            const change = next({ draft: current.draft, gateEvidence: current.gateEvidence })
            if (change === null) return current
            await tx.update(
                ModuleSetupSessionEntity,
                { id: sessionId },
                { draftSnapshot: change.draft, gateEvidence: change.gateEvidence },
            )
            return { ...current, draft: change.draft, gateEvidence: change.gateEvidence }
        })
    }

    /** Closes the draft as applied. */
    async close(sessionId: string): Promise<void> {
        await this.entityManager.update(ModuleSetupSessionEntity, { id: sessionId }, { status: "applied" })
    }

    /** Takes one fact out of the open draft of an installation; a closed session is left as it is. */
    async dropFact(installationId: string, factKey: string): Promise<void> {
        const latest = await this.latest(installationId)
        if (latest?.status !== "draft") return
        await this.change(latest.id, (current) => {
            const facts = current.draft.facts.filter((fact) => fact.key !== factKey)
            return facts.length === current.draft.facts.length
                ? null
                : { draft: { ...current.draft, facts }, gateEvidence: current.gateEvidence }
        })
    }
}

const UNIQUE_VIOLATION = "23505"

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION
