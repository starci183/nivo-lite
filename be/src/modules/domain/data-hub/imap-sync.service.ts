import { Injectable } from "@nestjs/common"
import { InjectImap } from "@modules/integrations/data-sources"
import type { ImapClient } from "@modules/integrations/data-sources"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { IMAP_CONNECTION_TEXT, imapMoreNote } from "./messages/imap-connection.messages"
import { cursorKey, parseConfig, parseCredential } from "./imap-connection.policy"

const DAY_MS = 86_400_000

@Injectable()
/** Pulls the owner mailboxes into the hub. */
export class ImapSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "imap" as const

    constructor(
        @InjectImap() private readonly imap: ImapClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

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
