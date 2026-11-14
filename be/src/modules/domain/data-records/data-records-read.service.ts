import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataReadService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    CustomerRecordRows,
    MailAttachments,
    MailHeadRow,
    OptionalHubPoint,
    OptionalMailAttachments,
    OptionalMailFullRow,
    OptionalSinceDay,
} from "./data-records-read.contracts"
import {
    byDateNewestFirst,
    carriesXml,
    datedFrom,
    isRowId,
    mailAttachmentsOf,
    mailFullRowOf,
    mailHeadRowOf,
    type StoredMail,
} from "./data-records-read.policy"
import { IMAP_MAIL_TYPE, IMAP_PROVIDER } from "./imap.data-types"
import { DataRecordEntity } from "./persistence/entities"

/** The most mailboxes of a workspace the e-invoice read looks across (as the mail tools do). */
const MAILBOXES_MAX = 20

/** The newest mails of each mailbox the e-invoice read looks at (the store's bound of one `newest` read). */
const NEWEST_PER_MAILBOX = 200

/** A stored mail row as the account store answers it, with its mailbox. */
interface StoredMailRow {
    /** The row id. */
    readonly id: string
    /** When the row entered the store, as text. */
    readonly createdAt: string
    /** The value. */
    readonly value: Readonly<Record<string, unknown>>
}

@Injectable()
/**
 * Request-time reads for other capabilities, always scoped to the workspace and bounded by the caller. The mails of a mailbox are the
 * account's own `imap.mail` rows (account data of the IMAP connection); the customer rows are the hub's. An app that registers no account
 * data or no connections read (a proof world without mailboxes) reads no mail.
 */
export class DataRecordsReadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @Optional() private readonly accountData?: AccountDataReadService,
        @Optional() private readonly bindings?: ConnectionBindingsReadService,
    ) {}

    /**
     * The newest mails of the workspace that carry an XML attachment, optionally from a date on, with their attachments: across the
     * workspace's mailboxes (at most 20), the newest 200 mails of each, newest first by date, at most `limit`.
     */
    async mailsWithXml(workspaceId: string, since: OptionalSinceDay, limit: number): Promise<Array<MailAttachments>> {
        const accountData = this.accountData
        if (accountData === undefined || this.bindings === undefined) return []
        const boxes = await this.bindings.ofProvider(workspaceId, IMAP_PROVIDER, MAILBOXES_MAX)
        const found: Array<Pick<StoredMail, "id" | "value">> = []
        await eachInOrder(boxes, async (box) => {
            const rows = await accountData.newest(box.id, IMAP_MAIL_TYPE, NEWEST_PER_MAILBOX)
            found.push(...rows.filter((row) => carriesXml(row.value) && (since === undefined || datedFrom(row.value, since))))
        })
        return found
            .toSorted(byDateNewestFirst)
            .slice(0, limit)
            .map((mail) => mailAttachmentsOf(mail))
    }

    /** The mail of the workspace with this id and its attachments; none when the workspace has no such mail. */
    async mailAttachments(workspaceId: string, recordId: string): Promise<OptionalMailAttachments> {
        const mail = await this.mailOf(workspaceId, recordId)
        return mail === null ? undefined : mailAttachmentsOf(mail)
    }

    /**
     * The mails of one mailbox (IMAP connection) of the workspace that entered the store after a point, in the order they entered it, at
     * most `limit`: the head of each and the first `opening` characters of its text, never the whole text. A mailbox of another
     * workspace has none.
     */
    async mailsAfter(
        workspaceId: string,
        connectionId: string,
        after: OptionalHubPoint,
        limit: number,
        opening: number,
    ): Promise<Array<MailHeadRow>> {
        if (this.accountData === undefined || !(await this.holds(workspaceId, connectionId))) return []
        const point = after === null ? null : { createdAt: after.seenAt, id: after.id }
        const rows = await this.accountData.after(connectionId, IMAP_MAIL_TYPE, point, limit)
        return rows.map((row) => mailHeadRowOf(this.storedOf(connectionId, row), opening))
    }

    /** One mail, whole, by its id, when one of the given mailboxes of the workspace holds it; none otherwise. */
    async mailIn(
        workspaceId: string,
        connectionIds: ReadonlyArray<string>,
        recordId: string,
    ): Promise<OptionalMailFullRow> {
        if (connectionIds.length === 0) return undefined
        const mail = await this.mailOf(workspaceId, recordId)
        return mail === null || !connectionIds.includes(mail.connectionId) ? undefined : mailFullRowOf(mail)
    }

    /** The newest customer rows of the workspace, at most `limit`, each with the connection it was synced from. */
    async customerRecords(workspaceId: string, limit: number): Promise<Array<CustomerRecordRows>> {
        const rows = await this.entityManager.find(DataRecordEntity, {
            select: { connectionId: true, externalId: true, title: true, data: true },
            where: { workspaceId, entity: "customer" },
            order: { syncedAt: "DESC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            connectionId: row.connectionId,
            externalId: row.externalId,
            title: row.title,
            data: Object.fromEntries(Object.entries(row.data)),
        }))
    }

    /** The stored mail with this row id when its mailbox is one of the workspace's; null otherwise (an id of no row's shape included). */
    private async mailOf(workspaceId: string, recordId: string): Promise<StoredMail | null> {
        if (this.accountData === undefined || !isRowId(recordId)) return null
        const row = await this.accountData.byId(IMAP_MAIL_TYPE, recordId)
        if (row === null || !(await this.holds(workspaceId, row.connectionId))) return null
        return this.storedOf(row.connectionId, row)
    }

    /** True when the connection is one of the workspace's. */
    private async holds(workspaceId: string, connectionId: string): Promise<boolean> {
        if (this.bindings === undefined) return false
        return (await this.bindings.workspaceOf(connectionId, this.entityManager)) === workspaceId
    }

    private storedOf(connectionId: string, row: StoredMailRow): StoredMail {
        return { id: row.id, connectionId, createdAt: row.createdAt, value: row.value }
    }
}
