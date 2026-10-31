import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewSetupMessage, OptionalSetupMessageRecord, SetupMessageRecord } from "./module-setup-messages.contracts"
import { ModuleSetupMessageEntity } from "./persistence/entities"

/** How many lines of a setup chat are read at once. */
const CHAT_LIMIT = 2000

/** Maps a stored line to its contract. */
const toRecord = (row: ModuleSetupMessageEntity): SetupMessageRecord => ({
    id: row.id,
    setupSessionId: row.setupSessionId,
    role: row.role,
    author: row.author,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
})

@Injectable()
/** The setup chat of the installations: the only owner of the module_setup_messages table. */
export class SetupMessagesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly sessions: SetupSessionsService,
    ) {}

    /** The whole chat of an installation across its revisions, oldest first. */
    async ofInstallation(installationId: string): Promise<ReadonlyArray<SetupMessageRecord>> {
        const revisions = await this.sessions.revisions(installationId)
        if (revisions.length === 0) return []
        const rows = await this.entityManager.find(ModuleSetupMessageEntity, {
            where: { setupSessionId: In(revisions.map((revision) => revision.id)) },
            order: { createdAt: "ASC", id: "ASC" },
            take: CHAT_LIMIT,
        })
        return rows.map(toRecord)
    }

    /** The chat of one session, oldest first. */
    async ofSession(sessionId: string): Promise<ReadonlyArray<SetupMessageRecord>> {
        const rows = await this.entityManager.find(ModuleSetupMessageEntity, {
            where: { setupSessionId: sessionId },
            order: { createdAt: "ASC", id: "ASC" },
            take: CHAT_LIMIT,
        })
        return rows.map(toRecord)
    }

    /** One message of the workspace by id; null when there is none. */
    async find(workspaceId: string, messageId: string): Promise<OptionalSetupMessageRecord> {
        const row = await this.entityManager.findOne(ModuleSetupMessageEntity, {
            where: { id: messageId, workspaceId },
        })
        return row === null ? null : toRecord(row)
    }

    /**
     * Stores one line of the chat and answers it as stored. The database sets the time of the line, which an insert does not hand
     * back, so the line is read again; a caller that queues work on the line passes its transaction, so both commit or neither.
     */
    async post(message: NewSetupMessage, manager: EntityManager = this.entityManager): Promise<SetupMessageRecord> {
        const saved = await manager.save(ModuleSetupMessageEntity, {
            workspaceId: message.workspaceId,
            setupSessionId: message.setupSessionId,
            role: message.role,
            author: message.author,
            body: message.body,
        })
        const row = await manager.findOneOrFail(ModuleSetupMessageEntity, { where: { id: saved.id } })
        return toRecord(row)
    }
}
