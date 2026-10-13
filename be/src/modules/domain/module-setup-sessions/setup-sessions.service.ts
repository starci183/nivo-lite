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
import {
    CLOSE_SESSION,
    FIND_LATEST_SESSION,
    FIND_SESSION,
    INSERT_SESSION,
    LIST_REVISIONS,
    SAVE_TURN,
} from "./persistence/module-setup-sessions.sql"

@Injectable()
/** The draft sessions of the setup chat: the only owner of the module_setup_sessions table. */
export class SetupSessionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest revision of an installation; null before the chat was opened. */
    async latest(installationId: string): Promise<OptionalSetupSessionRecord> {
        const [row] = await this.entityManager.query<Array<SetupSessionRecord>>(FIND_LATEST_SESSION, [installationId])
        return row ?? null
    }

    /** One session of the workspace by id; null when there is none. */
    async find(workspaceId: string, sessionId: string): Promise<OptionalSetupSessionRecord> {
        const [row] = await this.entityManager.query<Array<SetupSessionRecord>>(FIND_SESSION, [sessionId, workspaceId])
        return row ?? null
    }

    /** Every revision of an installation, oldest first. */
    revisions(installationId: string): Promise<ReadonlyArray<SetupRevisionRecord>> {
        return this.entityManager.query<Array<SetupRevisionRecord>>(LIST_REVISIONS, [installationId])
    }

    /** Opens the next draft; null when another call opened the same revision first. */
    async open(session: NewSetupSession): Promise<OptionalSetupSessionRecord> {
        const rows = await this.entityManager
            .query<Array<SetupSessionRecord>>(INSERT_SESSION, [
                session.workspaceId,
                session.installationId,
                session.revision,
                JSON.stringify(session.draft),
                JSON.stringify(session.gateEvidence),
            ])
            .catch((cause: unknown) => {
                if (isUniqueViolation(cause)) return []
                throw cause
            })
        return rows[0] ?? null
    }

    /** Stores the draft and the gate evidence on the open draft; null when the session is not a draft any more. */
    async save(sessionId: string, change: SetupSessionChange): Promise<OptionalSetupSessionRecord> {
        const [row] = await this.entityManager.query<Array<SetupSessionRecord>>(SAVE_TURN, [
            sessionId,
            JSON.stringify(change.draft),
            JSON.stringify(change.gateEvidence),
        ])
        return row ?? null
    }

    /** Closes the draft as applied. */
    async close(sessionId: string): Promise<void> {
        await this.entityManager.query(CLOSE_SESSION, [sessionId])
    }

    /** Takes one fact out of the open draft of an installation; a closed session is left as it is. */
    async dropFact(installationId: string, factKey: string): Promise<void> {
        const latest = await this.latest(installationId)
        if (latest === null || latest.status !== "draft") return
        const facts = latest.draft.facts.filter((fact) => fact.key !== factKey)
        if (facts.length === latest.draft.facts.length) return
        await this.save(latest.id, { draft: { ...latest.draft, facts }, gateEvidence: latest.gateEvidence })
    }
}

const UNIQUE_VIOLATION = "23505"

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION
