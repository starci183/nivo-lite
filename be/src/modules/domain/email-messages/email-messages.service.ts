import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EmailRecord, OptionalVia } from "./email-messages.contracts"
import { EmailMessagesError, EmailMessagesErrorCode } from "./errors/email-messages.error"
import type { EmailCountRow, EmailMessageIdRow } from "./persistence/email-messages.rows"
import { COUNT_SENT_EMAILS, INSERT_EMAIL_MESSAGE } from "./persistence/email-messages.sql"

@Injectable()
/** The log of every email attempt of a workspace: the only writer of public.email_messages. */
export class EmailMessagesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes down one send attempt and answers its id. */
    async record(entry: EmailRecord): Promise<string> {
        const [row] = await this.entityManager.query<Array<EmailMessageIdRow>>(INSERT_EMAIL_MESSAGE, [
            entry.workspaceId,
            entry.connectionId,
            entry.to,
            entry.subject,
            entry.purpose,
            entry.status,
            entry.via,
            entry.providerMessageId,
            entry.error,
            JSON.stringify(entry.refs),
        ])
        if (row === undefined) throw new EmailMessagesError({ code: EmailMessagesErrorCode.NotRecorded })
        return row.id
    }

    /** How many messages the workspace sent since a time, optionally only through one sender. */
    async sentSince(workspaceId: string, since: Date, via: OptionalVia): Promise<number> {
        const [row] = await this.entityManager.query<Array<EmailCountRow>>(COUNT_SENT_EMAILS, [
            workspaceId,
            since.toISOString(),
            via,
        ])
        return row?.n ?? 0
    }
}
