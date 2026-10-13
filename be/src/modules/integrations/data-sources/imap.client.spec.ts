import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DATA_SOURCES_OPTIONS, PUBLIC_HOST } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { ImapClient } from "./imap.client"
import type { ImapFolderRequest, ImapLogin, ImapPullRequest } from "./imap-mailbox.contracts"
import { ImapLogEvent } from "./imap.log-events"
import { IMAP_TEXT } from "./messages/imap.messages"
import type { PublicHostClient } from "./public-host.client"

class MockMail {
    fail: Error | undefined = undefined
    readonly value = {
        text: "Hello",
        subject: "Order",
        attachments: [],
        html: false,
        date: new Date("2026-01-02T03:04:05.000Z"),
    }
}

class MockImapState {
    connectError: Error | undefined = undefined
    logoutError: Error | undefined = undefined
    listError: Error | undefined = undefined
    lockError: Error | undefined = undefined
    searchResult: Array<number> | false | undefined = []
    mailbox: { uidValidity: number } | false = { uidValidity: 9 }
    boxes: Array<{ path: string; flags: Set<string> }> = []
    messages: Array<{ uid: number; source?: Buffer; internalDate: Date }> = []
    searches: Array<{ query: object; options: object }> = []
    fetches: Array<string> = []
    options: Record<string, unknown> = {}
    released = false
    closed = false
    errorListener: (() => void) | undefined = undefined

    reset(): void {
        this.connectError = undefined
        this.logoutError = undefined
        this.listError = undefined
        this.lockError = undefined
        this.searchResult = []
        this.mailbox = { uidValidity: 9 }
        this.boxes = []
        this.messages = []
        this.searches = []
        this.fetches = []
        this.options = {}
        this.released = false
        this.closed = false
        this.errorListener = undefined
    }
}

const mockImap = new MockImapState()
const mockMail = new MockMail()

jest.mock("mailparser", () => ({
    simpleParser: () => (mockMail.fail === undefined ? Promise.resolve(mockMail.value) : Promise.reject(mockMail.fail)),
}))

jest.mock("imapflow", () => ({
    ImapFlow: class {
        mailbox: MockImapState["mailbox"] = { uidValidity: 9 }

        constructor(options: Record<string, unknown>) {
            mockImap.options = options
            this.mailbox = mockImap.mailbox
        }

        on(_event: string, listener: () => void): void {
            mockImap.errorListener = listener
        }

        connect(): Promise<void> {
            return mockImap.connectError === undefined ? Promise.resolve() : Promise.reject(mockImap.connectError)
        }

        close(): void {
            mockImap.closed = true
        }

        logout(): Promise<void> {
            return mockImap.logoutError === undefined ? Promise.resolve() : Promise.reject(mockImap.logoutError)
        }

        list(): Promise<MockImapState["boxes"]> {
            return mockImap.listError === undefined
                ? Promise.resolve(mockImap.boxes)
                : Promise.reject(mockImap.listError)
        }

        getMailboxLock(): Promise<{ release: () => void }> {
            if (mockImap.lockError !== undefined) return Promise.reject(mockImap.lockError)
            return Promise.resolve({
                release: () => {
                    mockImap.released = true
                },
            })
        }

        search(query: object, options: object): Promise<Array<number> | false | undefined> {
            mockImap.searches.push({ query, options })
            return Promise.resolve(mockImap.searchResult)
        }

        *fetch(range: string): Generator<MockImapState["messages"][number]> {
            mockImap.fetches.push(range)
            for (const message of mockImap.messages) yield message
        }
    },
}))

const login: ImapLogin = { host: "mail.example", port: 993, secure: true, user: "ada", password: "secret" }
const options = (allowPrivateHosts: boolean): DataSourcesOptions => ({ allowPrivateHosts, telegramUser: null })

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
        mockImap.reset()
        mockMail.fail = undefined
    })

    describe("listFolders", () => {
        it("lists selectable folders with INBOX first and drops the connection when logout fails", async () => {
            const { client, logger, hosts } = await build(true)
            mockImap.boxes = [
                { path: "Sent", flags: new Set() },
                { path: "Archive", flags: new Set([String.raw`\Noselect`]) },
                { path: "Gone", flags: new Set([String.raw`\NonExistent`]) },
                { path: "INBOX", flags: new Set() },
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
            expect(mockImap.options.servername).toBeUndefined()
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
            expect(mockImap.options.doSTARTTLS).toBeUndefined()
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
                { uid: 1, internalDate: new Date("2026-01-02T00:00:00.000Z") },
                { uid: 3, source: Buffer.from("raw"), internalDate: new Date("2026-01-03T00:00:00.000Z") },
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
            mockImap.messages = [
                { uid: 1, source: Buffer.from("raw"), internalDate: new Date("2026-01-02T00:00:00.000Z") },
            ]
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

            mockImap.mailbox = { uidValidity: 9 }
            mockImap.searchResult = [1]
            mockImap.messages = [
                { uid: 1, source: Buffer.from("raw"), internalDate: new Date("2026-01-02T00:00:00.000Z") },
            ]
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
    })
})
