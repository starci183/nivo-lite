import { Injectable } from "@nestjs/common"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { cursorKey } from "./imap-connection.policy"
import {
    IMAP_PULL_OPERATION,
    IMAP_SANDBOX_DELIVERED_STATE,
    IMAP_SANDBOX_FOLDER,
    IMAP_SANDBOX_PROVIDER,
    IMAP_SANDBOX_UID_STATE,
    IMAP_SANDBOX_UID_VALIDITY,
    imapRowsOf,
    imapSetIdOf,
} from "./imap-sandbox.catalogue"

@Injectable()
/**
 * The sandbox twin of the mailbox pull (`IMAP-1` .. `7`): the normal poll of a sandbox IMAP account hands the account's hardcoded mails
 * to the SAME keep path the live pull uses (`context.upsert`, which the sync service answers with `ImapSyncService.keep`), and never
 * builds an IMAP client or reads a credential. The account's next case picks the SET the poll delivers (default `IMAP-1`). Each set is
 * delivered ONCE per account: its mails take the next UIDs of the sandbox INBOX (state `imap-uid`), so a second poll adds nothing and
 * the next set adds new mails; the folder cursor moves as the live one does (`<uidvalidity>:<uid>`). Mail dates derive from the moment of
 * the poll. One logged call per poll.
 */
export class ImapSandboxSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "imap" as const

    constructor(
        private readonly sandbox: ProviderSandboxService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Delivers the picked set's mails once and answers how many were new, with the INBOX cursor. */
    sync(context: DataSyncContext): Promise<DataSyncResult> {
        const { connection } = context
        const account = {
            id: connection.id,
            workspaceId: connection.workspaceId,
            provider: IMAP_SANDBOX_PROVIDER,
            sandbox: connection.sandbox === true,
        }
        return this.sandbox.call(account, IMAP_PULL_OPERATION, { folders: [IMAP_SANDBOX_FOLDER] }, {
            key: IMAP_SANDBOX_FOLDER,
            answer: async (state): Promise<DataSyncResult> => {
                const setId = imapSetIdOf(state.nextCase)
                if ((await state.read(IMAP_SANDBOX_DELIVERED_STATE, setId)) !== null) return { rows: 0, meta: {} }
                const kept = await state.read(IMAP_SANDBOX_UID_STATE, IMAP_SANDBOX_FOLDER)
                const last = typeof kept === "number" ? kept : 0
                const rows = imapRowsOf(setId, last + 1, this.clock.now())
                const written = await context.upsert("message", rows)
                const newest = last + rows.length
                await state.write(IMAP_SANDBOX_UID_STATE, IMAP_SANDBOX_FOLDER, newest)
                await state.write(IMAP_SANDBOX_DELIVERED_STATE, setId, true)
                return { rows: written, meta: { [cursorKey(IMAP_SANDBOX_FOLDER)]: `${IMAP_SANDBOX_UID_VALIDITY}:${newest}` } }
            },
        })
    }
}
