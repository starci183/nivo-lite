import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import * as imapflow from "imapflow"
import type { FetchMessageObject, ImapFlow, ImapFlowOptions, ListResponse, MailboxObject, SearchObject } from "imapflow"
import mailparser from "mailparser"
import type { ParsedMail } from "mailparser"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DATA_SOURCES_OPTIONS, PUBLIC_HOST } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { ImapClient } from "./imap.client"
import type { ImapFolderRequest, ImapLogin, ImapPullRequest } from "./imap-mailbox.contracts"
import { ImapLogEvent } from "./imap.log-events"
import { IMAP_TEXT } from "./messages/imap.messages"
import type { PublicHostClient } from "./public-host.client"

/** What the parser answers for every message, or the failure it raises. */
class MockMail {
    fail: Error | undefined = undefined
    readonly value: ParsedMail = {
        attachments: [],
        headers: new Map(),
        headerLines: [],
        text: "Hello",
        subject: "Order",
        html: false,
        date: new Date("2026-01-02T03:04:05.000Z"),
    }
}

const mailboxOf = (uidValidity: bigint): MailboxObject => ({
    path: "INBOX",
    delimiter: "/",
    flags: new Set(),
    uidValidity,
    uidNext: 1,
    exists: 0,
})

/** What the server holds and how it answers; the fake client of each connection reads it. */
class MockImapState {
    connectError: Error | undefined = undefined
    logoutError: Error | undefined = undefined
    listError: Error | undefined = undefined
    lockError: Error | undefined = undefined
    releaseError: DataSourcesError | undefined = undefined
    searchResult: Array<number> | false | undefined = []
    mailbox: MailboxObject | false = mailboxOf(9n)
    boxes: Array<ListResponse> = []
    messages: Array<FetchMessageObject> = []
    searches: Array<{ query: SearchObject; options: unknown }> = []
    fetches: Array<string> = []
    options: ImapFlowOptions | undefined = undefined
    released = false
    closed = false
    errorListener: (() => void) | undefined = undefined
}

const boxOf = (path: string, flags: ReadonlyArray<string> = []): ListResponse => ({
    path,
    pathAsListed: path,
    name: path,
    delimiter: "/",
    parent: [],
    parentPath: "",
    flags: new Set(flags),
    listed: true,
    subscribed: true,
})

const messageOf = (uid: number, internalDate: string, source?: string): FetchMessageObject => ({
    seq: uid,
    uid,
    internalDate: new Date(internalDate),
    ...(source === undefined ? {} : { source: Buffer.from(source) }),
})

async function* listed(
    messages: ReadonlyArray<FetchMessageObject>,
): AsyncGenerator<FetchMessageObject, void, undefined> {
    yield* await Promise.resolve(messages)
}

const mockImap = new MockImapState()
const mockMail = new MockMail()

/** A client of one connection over the server state of the running test. */
const connectionOf = (options?: ImapFlowOptions): ImapFlow => {
    const state = mockImap
    state.options = options
    const connection = mock<ImapFlow>({ mailbox: state.mailbox })
    connection.on.mockImplementation((_event, listener) => {
        state.errorListener = listener
        return connection
    })
    connection.connect.mockImplementation(() =>
        state.connectError === undefined ? Promise.resolve() : Promise.reject(state.connectError),
    )
    connection.close.mockImplementation(() => {
        state.closed = true
    })
    connection.logout.mockImplementation(() =>
        state.logoutError === undefined ? Promise.resolve() : Promise.reject(state.logoutError),
    )
    connection.list.mockImplementation(() =>
        state.listError === undefined ? Promise.resolve(state.boxes) : Promise.reject(state.listError),
    )
    connection.getMailboxLock.mockImplementation((path) => {
        if (state.lockError !== undefined) return Promise.reject(state.lockError)
        return Promise.resolve({
            path: String(path),
            release: () => {
                state.released = true
                if (state.releaseError !== undefined) throw state.releaseError
            },
        })
    })
    connection.search.mockImplementation((query, searchOptions) => {
        state.searches.push({ query, options: searchOptions })
        return Promise.resolve(state.searchResult)
    })
    connection.fetch.mockImplementation((range) => {
        state.fetches.push(typeof range === "string" ? range : JSON.stringify(range))
        return listed(state.messages)
    })
    return connection
}

const imapSpy = jest.spyOn(imapflow, "ImapFlow")
const parserSpy = jest.spyOn(mailparser, "simpleParser")

const login: ImapLogin = { host: "mail.example", port: 993, secure: true, user: "ada", password: "secret" }
const options = (allowPrivateHosts: boolean): DataSourcesOptions => ({ allowPrivateHosts })

const build = async (allowPrivateHosts = false) => {
    const logger = mock<Logger>()
    const hosts = mock<PublicHostClient>()
    hosts.resolve.mockResolvedValue({ address: "203.0.113.5", family: 4 })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ImapClient,
            { provide: LOGGER, useValue: logger },
            { provide: DATA_SOURCES_OPTIONS, useValue: options(allowPrivateHosts) },
            { provide: PUBLIC_HOST, useValue: hosts },
        ],
    }).compile()
    return { client: moduleRef.get(ImapClient), logger, hosts }
}

const pull = (partial: Partial<ImapPullRequest> = {}): ImapPullRequest => ({
    folders: [{ path: "INBOX", cursor: null }],
    since: new Date("2026-01-01T00:00:00.000Z"),
    isExpired: () => false,
    deliver: () => Promise.resolve(1),
    ...partial,
})

describe("ImapClient", () => {
    beforeEach(() => {
        Object.assign(mockImap, new MockImapState())
        mockMail.fail = undefined
        imapSpy.mockImplementation(connectionOf)
        parserSpy.mockImplementation(() =>
            mockMail.fail === undefined ? Promise.resolve(mockMail.value) : Promise.reject(mockMail.fail),
        )
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    describe("listFolders", () => {
        it("lists selectable folders with INBOX first and drops the connection when logout fails", async () => {
            const { client, logger, hosts } = await build(true)
            mockImap.boxes = [
                boxOf("Sent"),
                boxOf("Archive", [String.raw`\Noselect`]),
                boxOf("Gone", [String.raw`\NonExistent`]),
                boxOf("INBOX"),
            ]
            mockImap.logoutError = new Error("bye")

            await expect(client.listFolders({ ...login, host: "  [203.0.113.5]  ", secure: false })).resolves.toEqual([
                "INBOX",
                "Sent",
            ])
            expect(hosts.resolve).toHaveBeenCalledWith("  [203.0.113.5]  ")
            expect(mockImap.options).toMatchObject({
                host: "203.0.113.5",
                port: 993,
                secure: false,
                doSTARTTLS: true,
                auth: { user: "ada", pass: "secret" },
                tls: { rejectUnauthorized: false },
            })
            expect(mockImap.options?.servername).toBeUndefined()
            mockImap.errorListener?.()
            expect(logger.warn).toHaveBeenCalledWith(ImapLogEvent.LogoutFailed, { reason: IMAP_TEXT.generic })
            expect(mockImap.closed).toBe(true)
        })

        it("names the host for TLS and reports a refused login", async () => {
            const { client } = await build(false)
            const refused = Object.assign(new Error("no"), { code: "ECONNREFUSED" })
            mockImap.connectError = refused

            await expect(client.listFolders(login)).rejects.toMatchObject({
                code: DataSourcesErrorCode.Unavailable,
                params: { detail: IMAP_TEXT.refused },
                cause: refused,
            })
            expect(mockImap.options).toMatchObject({ servername: "mail.example", tls: { servername: "mail.example" } })
            expect(mockImap.options?.doSTARTTLS).toBeUndefined()
            expect(mockImap.closed).toBe(true)
        })

        it("reports a folder list that the server refused", async () => {
            const { client } = await build()
            const own = new Error(IMAP_TEXT.hostNotFound)
            mockImap.listError = own

            await expect(client.listFolders(login)).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: IMAP_TEXT.hostNotFound },
                cause: own,
            })
        })

        it("orders equally ranked folders alphabetically and preserves an integration error", async () => {
            const { client } = await build()
            mockImap.boxes = [boxOf("Sent"), boxOf("Archive"), boxOf("INBOX")]

            await expect(client.listFolders(login)).resolves.toEqual(["INBOX", "Archive", "Sent"])

            const failure = new DataSourcesError({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: "folder access denied" },
            })
            mockImap.listError = failure
            await expect(client.listFolders(login)).rejects.toBe(failure)
        })

        it("propagates a cleanup logger failure after the folder list succeeds", async () => {
            const { client, logger } = await build()
            const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
            mockImap.logoutError = new Error("logout unavailable")
            logger.warn.mockImplementation(() => {
                throw failure
            })

            await expect(client.listFolders(login)).rejects.toBe(failure)
            expect(logger.warn).toHaveBeenCalledWith(ImapLogEvent.LogoutFailed, { reason: IMAP_TEXT.generic })
        })

        it("propagates cleanup failure when listing folders also fails", async () => {
            const { client, logger } = await build()
            const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
            mockImap.listError = new Error("list unavailable")
            mockImap.logoutError = new Error("logout unavailable")
            logger.warn.mockImplementation(() => {
                throw failure
            })

            await expect(client.listFolders(login)).rejects.toBe(failure)
            expect(logger.warn).toHaveBeenCalledWith(ImapLogEvent.LogoutFailed, { reason: IMAP_TEXT.generic })
        })
    })

    describe("pull", () => {
        it("stops before a folder once the run is expired", async () => {
            const { client } = await build()

            await expect(client.pull(login, pull({ isExpired: () => true }))).resolves.toEqual({
                folders: [],
                expired: true,
            })
        })

        it("keeps a folder failure and still releases the lock", async () => {
            const { client } = await build()
            mockImap.lockError = new Error("mailbox does not exist")
            const folders: Array<ImapFolderRequest> = [
                { path: "INBOX", cursor: null },
                { path: "Sent", cursor: null },
            ]
            let calls = 0

            const result = await client.pull(
                login,
                pull({
                    folders,
                    isExpired: () => {
                        calls += 1
                        return calls > 1
                    },
                }),
            )

            expect(result.expired).toBe(true)
            expect(result.folders).toEqual([
                { path: "INBOX", cursor: null, rows: 0, more: false, failure: IMAP_TEXT.folderMissing },
            ])
        })

        it("writes a first cursor when a folder has no messages, and leaves a known cursor when the search is empty", async () => {
            const { client } = await build()
            mockImap.searchResult = false
            const first = await client.pull(login, pull())
            expect(first.folders).toEqual([{ path: "INBOX", cursor: "9:0", rows: 0, more: false, failure: null }])
            expect(mockImap.searches[0]?.query).toEqual({ since: new Date("2026-01-01T00:00:00.000Z") })
            expect(mockImap.released).toBe(true)

            mockImap.searchResult = undefined
            const again = await client.pull(login, pull({ folders: [{ path: "INBOX", cursor: "9:4" }] }))
            expect(again.folders).toEqual([{ path: "INBOX", cursor: null, rows: 0, more: false, failure: null }])
            expect(mockImap.searches.at(-1)?.query).toEqual({ uid: "5:*" })
        })

        it("stores the new messages, skips one without a source, and marks a page that was cut at 200", async () => {
            const { client, logger } = await build()
            const delivered: Array<number> = []
            mockImap.searchResult = [3, 1]
            mockImap.messages = [
                messageOf(1, "2026-01-02T00:00:00.000Z"),
                messageOf(3, "2026-01-03T00:00:00.000Z", "raw"),
            ]

            const result = await client.pull(
                login,
                pull({
                    folders: [{ path: "INBOX", cursor: "nope" }],
                    deliver: (rows) => {
                        delivered.push(rows.length)
                        return Promise.resolve(rows.length)
                    },
                }),
            )

            expect(delivered).toEqual([1])
            expect(result.folders[0]).toMatchObject({ cursor: "9:3", rows: 1, more: false, failure: null })
            expect(mockImap.fetches).toEqual(["1,3"])

            mockMail.fail = new Error("bad")
            mockImap.searchResult = Array.from({ length: 201 }, (_item, index) => index + 1)
            mockImap.messages = [messageOf(1, "2026-01-02T00:00:00.000Z", "raw")]
            const cut = await client.pull(login, pull({ folders: [{ path: "INBOX", cursor: "8:1" }] }))
            expect(cut.folders[0]).toMatchObject({ more: true, rows: 10, failure: null })
            expect(logger.warn).toHaveBeenCalledWith(ImapLogEvent.MessageUnreadable, { reason: IMAP_TEXT.generic })
        })

        it("answers an idle folder when the mailbox is not open and a failure when the read throws", async () => {
            const { client } = await build()
            mockImap.mailbox = false
            await expect(client.pull(login, pull())).resolves.toEqual({
                folders: [{ path: "INBOX", cursor: null, rows: 0, more: false, failure: null }],
                expired: false,
            })

            mockImap.mailbox = mailboxOf(9n)
            mockImap.searchResult = [1]
            mockImap.messages = [messageOf(1, "2026-01-02T00:00:00.000Z", "raw")]
            let seen = false
            const stopped = await client.pull(
                login,
                pull({
                    isExpired: () => {
                        const expired = seen
                        seen = true
                        return expired
                    },
                }),
            )
            expect(stopped.folders[0]).toMatchObject({ rows: 0, cursor: "9:0" })
        })

        it("does not check the deadline again after the first expired folder", async () => {
            const { client } = await build()
            const deadline = mock<{ expired: () => boolean }>()
            deadline.expired.mockReturnValue(true)

            await expect(
                client.pull(
                    login,
                    pull({
                        folders: [
                            { path: "INBOX", cursor: null },
                            { path: "Sent", cursor: null },
                        ],
                        isExpired: deadline.expired,
                    }),
                ),
            ).resolves.toEqual({ folders: [], expired: true })
            expect(deadline.expired).toHaveBeenCalledTimes(1)
            expect(mockImap.released).toBe(false)
        })

        it.each([false, undefined] as const)("keeps the known cursor when UID search returns %s", async (found) => {
            const { client } = await build()
            mockImap.searchResult = found

            await expect(client.pull(login, pull({ folders: [{ path: "INBOX", cursor: "9:4" }] }))).resolves.toEqual({
                folders: [{ path: "INBOX", cursor: null, rows: 0, more: false, failure: null }],
                expired: false,
            })
            expect(mockImap.searches).toEqual([{ query: { uid: "5:*" }, options: { uid: true } }])
        })

        it("handles an absent initial search and a fetch that returns no messages", async () => {
            const { client } = await build()
            mockImap.searchResult = undefined
            await expect(client.pull(login, pull())).resolves.toEqual({
                folders: [{ path: "INBOX", cursor: "9:0", rows: 0, more: false, failure: null }],
                expired: false,
            })

            mockImap.searchResult = [2, 5]
            const delivery = mock<{ write: ImapPullRequest["deliver"] }>()
            await expect(
                client.pull(login, pull({ folders: [{ path: "INBOX", cursor: "9:4" }], deliver: delivery.write })),
            ).resolves.toEqual({
                folders: [{ path: "INBOX", cursor: "9:4", rows: 0, more: false, failure: null }],
                expired: false,
            })
            expect(mockImap.fetches).toEqual(["5"])
            expect(delivery.write).not.toHaveBeenCalled()
        })

        it("records a delivery failure and releases the folder lock", async () => {
            const { client } = await build()
            mockImap.searchResult = [1]
            mockImap.messages = [messageOf(1, "2026-01-02T00:00:00.000Z", "raw")]
            const delivery = mock<{ write: ImapPullRequest["deliver"] }>()
            delivery.write.mockRejectedValue(new Error("delivery unavailable"))

            await expect(client.pull(login, pull({ deliver: delivery.write }))).resolves.toEqual({
                folders: [{ path: "INBOX", cursor: null, rows: 0, more: false, failure: IMAP_TEXT.generic }],
                expired: false,
            })
            expect(delivery.write).toHaveBeenCalledTimes(1)
            expect(mockImap.released).toBe(true)
        })

        it("parses an empty buffer when a fetched message no longer supplies its source", async () => {
            const { client } = await build()
            mockImap.searchResult = [1]
            const message = messageOf(1, "2026-01-02T00:00:00.000Z", "raw")
            let reads = 0
            Object.defineProperty(message, "source", {
                get: () => {
                    reads += 1
                    return reads === 1 ? Buffer.from("raw") : undefined
                },
            })
            mockImap.messages = [message]

            await expect(client.pull(login, pull())).resolves.toEqual({
                folders: [{ path: "INBOX", cursor: "9:1", rows: 1, more: false, failure: null }],
                expired: false,
            })
            expect(parserSpy).toHaveBeenCalledWith(Buffer.alloc(0))
        })

        it("propagates a mailbox lock release failure after reading the folder", async () => {
            const { client } = await build()
            const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
            mockImap.releaseError = failure

            await expect(client.pull(login, pull())).rejects.toBe(failure)
            expect(mockImap.released).toBe(true)
            expect(mockImap.searches).toEqual([
                { query: { since: new Date("2026-01-01T00:00:00.000Z") }, options: { uid: true } },
            ])
        })

        it("propagates a lock release failure when delivery also fails", async () => {
            const { client } = await build()
            const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
            mockImap.releaseError = failure
            mockImap.searchResult = [1]
            mockImap.messages = [messageOf(1, "2026-01-02T00:00:00.000Z", "raw")]
            const delivery = mock<{ write: ImapPullRequest["deliver"] }>()
            delivery.write.mockRejectedValue(new Error("delivery unavailable"))

            await expect(client.pull(login, pull({ deliver: delivery.write }))).rejects.toBe(failure)
            expect(delivery.write).toHaveBeenCalledTimes(1)
            expect(mockImap.released).toBe(true)
        })
    })
})
