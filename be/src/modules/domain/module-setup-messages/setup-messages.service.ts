import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewSetupMessage, OptionalSetupMessageRecord, SetupMessageRecord } from "./module-setup-messages.contracts"
import {
    FIND_MESSAGE,
    INSERT_SETUP_MESSAGE,
    LIST_INSTALLATION_MESSAGES,
    LIST_SESSION_MESSAGES,
} from "./persistence/module-setup-messages.sql"

@Injectable()
/** The setup chat of the installations: the only owner of the module_setup_messages table. */
export class SetupMessagesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The whole chat of an installation across its revisions, oldest first. */
    ofInstallation(installationId: string): Promise<ReadonlyArray<SetupMessageRecord>> {
        return this.entityManager.query<Array<SetupMessageRecord>>(LIST_INSTALLATION_MESSAGES, [installationId])
    }

    /** The chat of one session, oldest first. */
    ofSession(sessionId: string): Promise<ReadonlyArray<SetupMessageRecord>> {
        return this.entityManager.query<Array<SetupMessageRecord>>(LIST_SESSION_MESSAGES, [sessionId])
    }

    /** One message of the workspace by id; null when there is none. */
    async find(workspaceId: string, messageId: string): Promise<OptionalSetupMessageRecord> {
        const [row] = await this.entityManager.query<Array<SetupMessageRecord>>(FIND_MESSAGE, [messageId, workspaceId])
        return row ?? null
    }

    /** Stores one line of the chat and answers it. */
    async post(message: NewSetupMessage): Promise<SetupMessageRecord> {
        const [row] = await this.entityManager.query<[SetupMessageRecord]>(INSERT_SETUP_MESSAGE, [
            message.workspaceId,
            message.setupSessionId,
            message.role,
            message.author,
            message.body,
        ])
        return row
    }
}
