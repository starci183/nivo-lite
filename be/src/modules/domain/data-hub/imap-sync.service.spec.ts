import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { ImapClient } from "@modules/integrations/data-sources"
import { DataSourcesError, DataSourcesErrorCode, IMAP } from "@modules/integrations/data-sources"
import { CLOCK } from "@modules/platform/clock"
import type { DataSyncContext } from "./data-hub.contracts"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { ImapSyncService } from "./imap-sync.service"
import { IMAP_CONNECTION_TEXT, imapMoreNote } from "./messages/imap-connection.messages"

const credential = {
    host: "mail.example.com",
    port: 993,
    secure: true,
    user: "reader@example.com",
    password: "fixture-password",
}

const row = {
    externalId: "INBOX:123:8",
    title: "A message",
    occurredAt: new Date("2026-10-13T09:00:00.000Z"),
    data: { folder: "INBOX", subject: "A message" },
}

const idle = { path: "INBOX", cursor: null, rows: 0, more: false, failure: null }

const build = async (
    meta: Readonly<Record<string, string>> = {
        config: JSON.stringify({ folders: ["INBOX"], sinceDays: 30 }),
        "cursor:INBOX": "123:7",
    },
) => {
    const imap = mock<ImapClient>()
    const clock = new FakeClock("2026-10-14T10:00:00.000Z")
    const context = mock<DataSyncContext>({
        connection: {
            id: "connection-1",
            workspaceId: "workspace-1",
            provider: "imap",
            name: "Mailbox",
            status: "connected",
            lastError: null,
            meta,
            everyMinutes: 60,
            lastSyncAt: null,
        },
        credential: JSON.stringify(credential),
    })
    context.isExpired.mockReturnValue(false)
    context.upsert.mockResolvedValue(1)
    imap.pull.mockResolvedValue({ folders: [idle], expired: false })
    const moduleRef = await Test.createTestingModule({
        providers: [ImapSyncService, { provide: IMAP, useValue: imap }, { provide: CLOCK, useValue: clock }],
    }).compile()
    return { service: moduleRef.get(ImapSyncService), imap, clock, context }
}

describe("ImapSyncService", () => {
    it("reads configured folders with their cursors and look-back and writes delivered messages", async () => {
        const { service, imap, clock, context } = await build({
            config: JSON.stringify({ folders: ["INBOX", "Archive"], sinceDays: 7 }),
            "cursor:INBOX": "123:7",
        })
        const now = jest.spyOn(clock, "now")
        imap.pull.mockImplementation(async (_login, request) => {
            const written = await request.deliver([row])
            return {
                folders: [
                    { ...idle, cursor: "123:8", rows: written },
                    { ...idle, path: "Archive", cursor: "456:0" },
                ],
                expired: false,
            }
        })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            meta: { "cursor:INBOX": "123:8", "cursor:Archive": "456:0" },
        })
        expect(service.provider).toBe("imap")
        expect(imap.pull).toHaveBeenCalledTimes(1)
        expect(imap.pull.mock.calls[0]?.[0]).toEqual(credential)
        expect(imap.pull.mock.calls[0]?.[1].folders).toEqual([
            { path: "INBOX", cursor: "123:7" },
            { path: "Archive", cursor: null },
        ])
        expect(imap.pull.mock.calls[0]?.[1].since).toEqual(new Date("2026-10-07T10:00:00.000Z"))
        expect(imap.pull.mock.calls[0]?.[1].isExpired).toBe(context.isExpired)
        expect(context.upsert).toHaveBeenCalledWith("message", [row])
        expect(now).toHaveBeenCalledTimes(1)
    })

    it("sums the rows written across successful folders", async () => {
        const { service, imap, context } = await build({
            config: JSON.stringify({ folders: ["INBOX", "Archive"], sinceDays: 90 }),
        })
        imap.pull.mockResolvedValue({
            folders: [
                { ...idle, rows: 2, cursor: "123:9" },
                { ...idle, path: "Archive", rows: 3, cursor: "456:3" },
            ],
            expired: false,
        })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 5,
            meta: { "cursor:INBOX": "123:9", "cursor:Archive": "456:3" },
        })
        expect(imap.pull.mock.calls[0]?.[1].since).toEqual(new Date("2026-07-16T10:00:00.000Z"))
    })

    it("leaves cursors unchanged and omits the note when no folder has new messages", async () => {
        const { service, context } = await build()

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: {} })
        expect(context.upsert).not.toHaveBeenCalled()
    })
})

describe("ImapSyncService", () => {
    it("reports a failed folder without rejecting when another folder succeeds with no new rows", async () => {
        const { service, imap, context } = await build({
            config: JSON.stringify({ folders: ["INBOX", "Archive"], sinceDays: 30 }),
        })
        imap.pull.mockResolvedValue({
            folders: [
                { ...idle, failure: "Access denied" },
                { ...idle, path: "Archive", cursor: "456:0" },
            ],
            expired: false,
        })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            note: "INBOX: Access denied",
            meta: { "cursor:Archive": "456:0" },
        })
    })

    it("returns successful rows alongside a failed folder's detail", async () => {
        const { service, imap, context } = await build({
            config: JSON.stringify({ folders: ["INBOX", "Archive"], sinceDays: 30 }),
        })
        imap.pull.mockResolvedValue({
            folders: [
                { ...idle, rows: 2, cursor: "123:9" },
                { ...idle, path: "Archive", failure: "Folder unavailable" },
            ],
            expired: false,
        })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 2,
            note: "Archive: Folder unavailable",
            meta: { "cursor:INBOX": "123:9" },
        })
    })

    it("rejects with all folder failures in their reported order when none can be read", async () => {
        const { service, imap, context } = await build({
            config: JSON.stringify({ folders: ["INBOX", "Archive"], sinceDays: 30 }),
        })
        imap.pull.mockResolvedValue({
            folders: [
                { ...idle, failure: "Access denied" },
                { ...idle, path: "Archive", failure: "Folder unavailable" },
            ],
            expired: false,
        })

        const result = service.sync(context)

        await expect(result).rejects.toBeInstanceOf(DataHubError)
        await expect(result).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: "INBOX: Access denied Archive: Folder unavailable" },
        })
    })

    it("reports that new messages remain for a later run", async () => {
        const { service, imap, context } = await build()
        imap.pull.mockResolvedValue({ folders: [{ ...idle, more: true }], expired: false })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            note: imapMoreNote("INBOX"),
            meta: {},
        })
    })
})

describe("ImapSyncService", () => {
    it("appends the time-budget note after a folder's pending-message note", async () => {
        const { service, imap, context } = await build()
        imap.pull.mockResolvedValue({
            folders: [{ ...idle, rows: 1, cursor: "123:8", more: true }],
            expired: true,
        })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            note: `${imapMoreNote("INBOX")} ${IMAP_CONNECTION_TEXT.stoppedEarly}`,
            meta: { "cursor:INBOX": "123:8" },
        })
    })

    it("returns the time-budget note when no configured folder was reached", async () => {
        const { service, imap, context } = await build()
        imap.pull.mockResolvedValue({ folders: [], expired: true })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            note: IMAP_CONNECTION_TEXT.stoppedEarly,
            meta: {},
        })
    })

    it("returns an empty result when the saved configuration has no folders", async () => {
        const { service, imap, context } = await build({ config: JSON.stringify({ folders: [], sinceDays: 30 }) })
        imap.pull.mockResolvedValue({ folders: [], expired: false })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: {} })
        expect(imap.pull.mock.calls[0]?.[1].folders).toEqual([])
    })

    it("uses INBOX and a thirty-day look-back when the saved configuration is broken", async () => {
        const { service, imap, context } = await build({ config: "broken" })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: {} })
        expect(imap.pull.mock.calls[0]?.[1].folders).toEqual([{ path: "INBOX", cursor: null }])
        expect(imap.pull.mock.calls[0]?.[1].since).toEqual(new Date("2026-09-14T10:00:00.000Z"))
    })

    it("rejects malformed credentials before reading the clock or mailbox", async () => {
        const { service, imap, clock, context } = await build()
        const now = jest.spyOn(clock, "now")

        await expect(service.sync({ ...context, credential: "broken" })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: IMAP_CONNECTION_TEXT.credentialMissing },
        })
        expect(now).not.toHaveBeenCalled()
        expect(imap.pull).not.toHaveBeenCalled()
    })

    it("rejects credentials that lack the required login fields", async () => {
        const { service, imap, context } = await build()

        await expect(service.sync({ ...context, credential: "{}" })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: IMAP_CONNECTION_TEXT.credentialMissing },
        })
        expect(imap.pull).not.toHaveBeenCalled()
    })

    it("propagates the mailbox client's domain rejection", async () => {
        const { service, imap, context } = await build()
        const cause = new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail: "Login denied" } })
        imap.pull.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).not.toHaveBeenCalled()
    })
})

describe("ImapSyncService", () => {
    it("propagates an unexpected mailbox client failure", async () => {
        const { service, imap, context } = await build()
        const cause = new Error("Mailbox read failed")
        imap.pull.mockRejectedValue(cause)

        await expect(service.sync(context)).rejects.toBe(cause)
    })

    it("forwards persistence failures through the delivered message callback", async () => {
        const { service, imap, context } = await build()
        const cause = new Error("Message write failed")
        context.upsert.mockRejectedValue(cause)
        imap.pull.mockImplementation(async (_login, request) => {
            await request.deliver([row])
            return { folders: [idle], expired: false }
        })

        await expect(service.sync(context)).rejects.toBe(cause)
        expect(context.upsert).toHaveBeenCalledWith("message", [row])
    })
})
