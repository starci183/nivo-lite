import { isIP } from "node:net"
import { Injectable } from "@nestjs/common"
import { ImapFlow } from "imapflow"
import type { FetchMessageObject } from "imapflow"
import { simpleParser } from "mailparser"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectDataSourcesOptions, InjectPublicHost } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { describeImapError } from "./imap-error.policy"
import type {
    ImapFolderOutcome,
    ImapFolderRequest,
    ImapLogin,
    ImapMessageRow,
    ImapPullRequest,
    ImapPullResult,
} from "./imap-mailbox.contracts"
import { formatImapCursor, messageToRow, parseImapCursor, unreadableRow } from "./imap-message.policy"
import { ImapLogEvent } from "./imap.log-events"
import type { PublicHostClient } from "./public-host.client"

const MAX_NEW_PER_FOLDER = 200
const BATCH_SIZE = 20
const MAX_SOURCE = 2_000_000
const CONNECT_TIMEOUT_MS = 10_000
const SOCKET_TIMEOUT_MS = 60_000

const toError = (error: unknown): DataSourcesError => {
    if (error instanceof DataSourcesError) return error
    const failure = describeImapError(error)
    return new DataSourcesError({
        code: failure.rejected ? DataSourcesErrorCode.Rejected : DataSourcesErrorCode.Unavailable,
        params: { detail: failure.detail },
        cause: error,
    })
}

const folderRank = (path: string): number => (path === "INBOX" ? 0 : 1)

const compareFolders = (a: string, b: string): number => folderRank(a) - folderRank(b) || a.localeCompare(b)

const batchesOf = (uids: ReadonlyArray<number>): Array<Array<number>> => {
    const batches: Array<Array<number>> = []
    for (let start = 0; start < uids.length; start += BATCH_SIZE) batches.push(uids.slice(start, start + BATCH_SIZE))
    return batches
}

@Injectable()
/** The client that reads a mailbox over IMAP, read only. */
export class ImapClient {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectDataSourcesOptions() private readonly options: DataSourcesOptions,
        @InjectPublicHost() private readonly hosts: PublicHostClient,
    ) {}

    /** Logs in and lists the selectable folder paths, INBOX first. */
    async listFolders(login: ImapLogin): Promise<Array<string>> {
        const client = await this.open(login)
        let paths: Array<string>
        try {
            const list = await client.list()
            paths = list
                .filter((box) => !box.flags.has(String.raw`\Noselect`) && !box.flags.has(String.raw`\NonExistent`))
                .map((box) => box.path)
                .sort(compareFolders)
        } catch (error) {
            await this.close(client)
            throw toError(error)
        }
        await this.close(client)
        return paths
    }

    /** Reads the new messages of the folders, hands them to `deliver` folder by folder and answers the new cursors. */
    async pull(login: ImapLogin, request: ImapPullRequest): Promise<ImapPullResult> {
        const client = await this.open(login)
        const folders: Array<ImapFolderOutcome> = []
        let expired = false
        try {
            await eachInOrder(request.folders, async (folder) => {
                if (expired || request.isExpired()) {
                    expired = true
                    return
                }
                folders.push(await this.pullFolder(client, folder, request))
            })
        } finally {
            await this.close(client)
        }
        return { folders, expired }
    }

    private async open(login: ImapLogin): Promise<ImapFlow> {
        const { address } = await this.hosts.resolve(login.host)
        const host = login.host.trim().replace(/^\[|\]$/gu, "")
        const named = isIP(host) === 0 ? { servername: host } : {}
        const client = new ImapFlow({
            host: address,
            port: login.port,
            secure: login.secure,
            ...(login.secure ? {} : { doSTARTTLS: true }),
            ...named,
            tls: { ...named, ...(this.options.allowPrivateHosts ? { rejectUnauthorized: false } : {}) },
            auth: { user: login.user, pass: login.password },
            logger: false,
            disableAutoIdle: true,
            disableCompression: true,
            connectionTimeout: CONNECT_TIMEOUT_MS,
            greetingTimeout: CONNECT_TIMEOUT_MS,
            socketTimeout: SOCKET_TIMEOUT_MS,
        })
        client.on("error", () => undefined)
        try {
            await client.connect()
        } catch (error) {
            client.close()
            throw toError(error)
        }
        return client
    }

    private async close(client: ImapFlow): Promise<void> {
        try {
            await client.logout()
        } catch (error) {
            this.logger.warn(ImapLogEvent.LogoutFailed, { reason: describeImapError(error).detail })
            client.close()
        }
    }

    private async pullFolder(
        client: ImapFlow,
        folder: ImapFolderRequest,
        request: ImapPullRequest,
    ): Promise<ImapFolderOutcome> {
        const failed = (error: unknown): ImapFolderOutcome => ({
            path: folder.path,
            cursor: null,
            rows: 0,
            more: false,
            failure: describeImapError(error).detail,
        })
        let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>>
        try {
            lock = await client.getMailboxLock(folder.path, { readOnly: true })
        } catch (error) {
            return failed(error)
        }
        const outcome = await this.readOpenFolder(client, folder, request).catch((error: unknown) => failed(error))
        lock.release()
        return outcome
    }

    private async newUids(client: ImapFlow, known: number, since: Date): Promise<Array<number>> {
        if (known > 0) {
            const found = await client.search({ uid: `${known + 1}:*` }, { uid: true })
            return (found === false || found === undefined ? [] : found).filter((uid) => uid > known)
        }
        const found = await client.search({ since }, { uid: true })
        return found === false || found === undefined ? [] : found
    }

    private async readOpenFolder(
        client: ImapFlow,
        folder: ImapFolderRequest,
        request: ImapPullRequest,
    ): Promise<ImapFolderOutcome> {
        const box = client.mailbox
        const idle: ImapFolderOutcome = { path: folder.path, cursor: null, rows: 0, more: false, failure: null }
        if (box === false) return idle
        const validity = String(box.uidValidity)
        const previous = parseImapCursor(folder.cursor)
        const known = previous !== null && previous.validity === validity ? previous.uid : 0
        const found = (await this.newUids(client, known, request.since)).sort((a, b) => a - b)
        const more = found.length > MAX_NEW_PER_FOLDER
        const uids = found.slice(0, MAX_NEW_PER_FOLDER)
        if (uids.length === 0) return known === 0 ? { ...idle, cursor: formatImapCursor(validity, 0) } : idle
        let last = known
        let written = 0
        await eachInOrder(batchesOf(uids), async (batch) => {
            if (request.isExpired()) return
            const messages = await this.fetchBatch(client, batch)
            const rows = await Promise.all(messages.map((message) => this.toRow(folder.path, validity, message)))
            if (rows.length > 0) written += await request.deliver(rows)
            last = messages.reduce((top, message) => Math.max(top, message.uid), last)
        })
        return { path: folder.path, cursor: formatImapCursor(validity, last), rows: written, more, failure: null }
    }

    private async fetchBatch(client: ImapFlow, uids: ReadonlyArray<number>): Promise<Array<FetchMessageObject>> {
        const messages: Array<FetchMessageObject> = []
        for await (const message of client.fetch(
            uids.join(","),
            { uid: true, internalDate: true, source: { maxLength: MAX_SOURCE } },
            { uid: true },
        )) {
            if (message.source !== undefined) messages.push(message)
        }
        return messages
    }

    private async toRow(folder: string, validity: string, message: FetchMessageObject): Promise<ImapMessageRow> {
        try {
            const mail = await simpleParser(message.source ?? Buffer.alloc(0))
            return messageToRow(folder, validity, message.uid, mail, message.internalDate)
        } catch (error) {
            this.logger.warn(ImapLogEvent.MessageUnreadable, { reason: describeImapError(error).detail })
            return unreadableRow(folder, validity, message.uid, message.internalDate)
        }
    }
}
