import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AccountDataInput, AccountWrite } from "@modules/domain/account-data"
import { ProviderTriggersLogEvent, ProviderTriggersService, type DeliveredEvent } from "@modules/domain/provider-triggers"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { IMAP_MAIL_TRIGGER, MAIL_RECEIVED } from "./imap-mail.trigger"

@Injectable()
/**
 * THE MAILBOX'S ENTRY to the one event pipeline (concept triggers rule 13): each mail the IMAP sync kept as a NEW `imap.mail` row of the
 * account (the INBOX: keyed by `<folder>:<uidvalidity>:<uid>`, so a mail read twice is one row) is translated by the mailbox's pure
 * trigger declaration and handed to the ONE delivery function, which applies the account's switch. The mail's words never ride on the
 * event: a workflow reads them through the mail tool. It runs inside a savepoint of the sync's write and never throws: the kept rows stand.
 */
export class DataSyncTriggerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly triggers?: ProviderTriggersService,
    ) {}

    /** Hands on the new mails of one write; `rows` are the `imap.mail` inputs written, `written` what the intake answered, in order. */
    async deliverMails(tx: EntityManager, rows: ReadonlyArray<AccountDataInput>, written: AccountWrite): Promise<void> {
        const { triggers } = this
        const owner = written.owner
        if (triggers === undefined || owner === null) return
        const events = rows.flatMap((row, index): ReadonlyArray<DeliveredEvent> => {
            const kept = written.rows[index]
            const value = IMAP_MAIL_TRIGGER.raw.safeParse(row.value)
            if (kept?.isNew !== true || !value.success) return []
            const event = IMAP_MAIL_TRIGGER.translate(value.data, { connectionId: owner.connectionId })
            if (event === null) return []
            return [{ event, raw: { type: kept.type, id: kept.id }, ...(event.data.at === undefined ? {} : { occurredAt: event.data.at }) }]
        })
        if (events.length === 0) return
        try {
            await tx.transaction((inner) =>
                triggers.deliver(
                    { workspaceId: owner.workspaceId, declaration: IMAP_MAIL_TRIGGER, connectionId: owner.connectionId, agentId: null, events },
                    inner,
                ),
            )
        } catch (cause) {
            this.logger.error(ProviderTriggersLogEvent.EmitFailed, cause, {
                workspaceId: owner.workspaceId,
                connectionId: owner.connectionId,
                trigger: MAIL_RECEIVED,
            })
        }
    }
}
