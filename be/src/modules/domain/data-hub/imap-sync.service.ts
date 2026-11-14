import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import { imapMailInputsOf, type DataRecordInput } from "@modules/domain/data-records"
import { InjectImap, type ImapClient } from "@modules/integrations/data-sources"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { DataSyncTriggerService } from "./data-sync-trigger.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { IMAP_CONNECTION_TEXT, imapMoreNote } from "./messages/imap-connection.messages"
import { cursorKey, parseConfig, parseCredential } from "./imap-connection.policy"

const DAY_MS = 86_400_000

@Injectable()
/**
 * Pulls the owner's mailboxes into the IMAP account's own data: each mail one `imap.mail` row (append: the first copy stands; the sync
 * reads each UID once). The folders' resume points stay in the connection's meta (`<uidvalidity>:<uid>` per folder).
 */
export class ImapSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "imap" as const

    constructor(
        @InjectImap() private readonly imap: ImapClient,
        @InjectClock() private readonly clock: Clock,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly intake: AccountDataIntakeService,
        @Optional() private readonly mails?: DataSyncTriggerService,
    ) {}

    /**
     * Keeps a batch of mails of the mailbox as its `imap.mail` rows in one transaction; answers how many were new (a mail already kept
     * is left as it is and not counted). Each new mail is handed to the mailbox's trigger in the same transaction. A connection nobody
     * holds any more keeps nothing.
     */
    async keep(connectionId: string, rows: ReadonlyArray<DataRecordInput>): Promise<number> {
        const inputs = imapMailInputsOf(rows)
        if (inputs.length === 0) return 0
        const written = await this.entityManager.transaction(async (tx) => {
            const write = await this.intake.write(tx, connectionId, inputs)
            await this.mails?.deliverMails(tx, inputs, write)
            return write
        })
        return written.rows.filter((row) => row.isNew).length
    }

    /** Reads the new messages of the chosen folders since each folder's cursor. */
    async sync(context: DataSyncContext): Promise<DataSyncResult> {
        const credential = parseCredential(context.credential)
        const config = parseConfig(context.connection.meta)
        const since = new Date(this.clock.now().getTime() - config.sinceDays * DAY_MS)
        const result = await this.imap.pull(credential, {
            folders: config.folders.map((path) => ({ path, cursor: context.connection.meta[cursorKey(path)] ?? null })),
            since,
            isExpired: context.isExpired,
            deliver: (rows) => context.upsert("message", rows),
        })
        const meta: Record<string, string> = {}
        const notes: Array<string> = []
        let total = 0
        for (const outcome of result.folders) {
            total += outcome.rows
            if (outcome.cursor !== null) meta[cursorKey(outcome.path)] = outcome.cursor
            if (outcome.failure !== null) notes.push(`${outcome.path}: ${outcome.failure}`)
            if (outcome.more) notes.push(imapMoreNote(outcome.path))
        }
        const failures = result.folders.filter((outcome) => outcome.failure !== null).length
        if (result.expired) notes.push(IMAP_CONNECTION_TEXT.stoppedEarly)
        if (total === 0 && failures >= config.folders.length && failures > 0) {
            throw new DataHubError({
                code: DataHubErrorCode.Invalid,
                params: { detail: notes.join(" ") },
            })
        }
        return { rows: total, ...(notes.length > 0 ? { note: notes.join(" ") } : {}), meta }
    }
}
