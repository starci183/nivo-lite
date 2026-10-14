import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { IMAP } from "@modules/integrations/data-sources"
import type { ImapClient } from "@modules/integrations/data-sources"
import { CLOCK } from "@modules/platform/clock"
import type { DataSyncContext } from "./data-hub.contracts"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { ImapSyncService } from "./imap-sync.service"
import { IMAP_CONNECTION_TEXT, imapMoreNote } from "./messages/imap-connection.messages"

const login = { host: "imap.example.com", port: 993, secure: true, user: "owner", password: "secret" }
const now = new Date("2026-10-14T08:30:00.000Z")
const build = async (
    meta: Readonly<Record<string, string>> = { config: '{"folders":["INBOX","Sent"],"sinceDays":7}' },
) => {
    const imap = mock<ImapClient>()
    const clock = new FakeClock(now)
    const context = mock<DataSyncContext>({
        connection: {
            id: "imap-1",
            workspaceId: "workspace-1",
            provider: "imap",
            name: "Mailbox",
            status: "connected",
            lastError: null,
            meta,
            everyMinutes: null,
            lastSyncAt: null,
        },
        credential: JSON.stringify(login),
    })
    context.isExpired.mockReturnValue(false)
    context.upsert.mockResolvedValue(4)
    imap.pull.mockResolvedValue({ folders: [], expired: false })
    const moduleRef = await Test.createTestingModule({
        providers: [ImapSyncService, { provide: IMAP, useValue: imap }, { provide: CLOCK, useValue: clock }],
    }).compile()
    return { service: moduleRef.get(ImapSyncService), imap, clock, context }
}

describe("ImapSyncService", () => {
    it("identifies its provider and forwards the login, folder cursors, look-back and delivery", async () => {
        const { service, imap, clock, context } = await build({
            config: '{"folders":["INBOX","Sent"],"sinceDays":7}',
            "cursor:INBOX": "3:8",
        })
        const readNow = jest.spyOn(clock, "now")
        const rows = [
            { externalId: "INBOX:3:9", title: "Support request", occurredAt: now, data: { from: "customer" } },
        ]
        imap.pull.mockImplementation(async (_login, request) => {
            expect(request.isExpired()).toBe(false)
            await expect(request.deliver(rows)).resolves.toBe(4)
            return {
                folders: [
                    { path: "INBOX", cursor: "3:9", rows: 4, more: false, failure: null },
                    { path: "Sent", cursor: null, rows: 2, more: false, failure: null },
                ],
                expired: false,
            }
        })

        expect(service.provider).toBe("imap")
        await expect(service.sync(context)).resolves.toEqual({ rows: 6, meta: { "cursor:INBOX": "3:9" } })
        expect(imap.pull).toHaveBeenCalledWith(login, {
            folders: [
                { path: "INBOX", cursor: "3:8" },
                { path: "Sent", cursor: null },
            ],
            since: new Date("2026-10-07T08:30:00.000Z"),
            isExpired: context.isExpired,
            deliver: expect.any(Function),
        })
        expect(readNow).toHaveBeenCalledTimes(1)
        expect(context.upsert).toHaveBeenCalledWith("message", rows)
        expect(context.isExpired).toHaveBeenCalledTimes(1)
    })

    it("combines partial failures, remaining messages and expiry in folder order while saving every non-null cursor", async () => {
        const { service, imap, context } = await build()
        imap.pull.mockResolvedValue({
            folders: [
                { path: "INBOX", cursor: "", rows: 0, more: true, failure: "Access denied" },
                { path: "Sent", cursor: "4:12", rows: 3, more: false, failure: "Read interrupted" },
            ],
            expired: true,
        })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 3,
            note: `INBOX: Access denied ${imapMoreNote("INBOX")} Sent: Read interrupted ${IMAP_CONNECTION_TEXT.stoppedEarly}`,
            meta: { "cursor:INBOX": "", "cursor:Sent": "4:12" },
        })
    })

    it("returns the failure note when one of two selected folders fails without writing any rows", async () => {
        const { service, imap, context } = await build()
        imap.pull.mockResolvedValue({
            folders: [
                { path: "INBOX", cursor: null, rows: 0, more: false, failure: "Access denied" },
                { path: "Sent", cursor: null, rows: 0, more: false, failure: null },
            ],
            expired: false,
        })

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, note: "INBOX: Access denied", meta: {} })
    })

    it("rejects a zero-row run when every selected folder failed and includes all collected notes", async () => {
        const { service, imap, context } = await build()
        imap.pull.mockResolvedValue({
            folders: [
                { path: "INBOX", cursor: null, rows: 0, more: true, failure: "Access denied" },
                { path: "Sent", cursor: null, rows: 0, more: false, failure: "Folder missing" },
            ],
            expired: true,
        })

        await expect(service.sync(context)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: {
                detail: `INBOX: Access denied ${imapMoreNote("INBOX")} Sent: Folder missing ${IMAP_CONNECTION_TEXT.stoppedEarly}`,
            },
        })
    })

    it("accepts an empty configured folder list without mistaking zero failures for an all-folder failure", async () => {
        const { service, imap, context } = await build({})

        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: {} })
        expect(imap.pull).toHaveBeenCalledWith(login, {
            folders: [],
            since: new Date("2026-09-14T08:30:00.000Z"),
            isExpired: context.isExpired,
            deliver: expect.any(Function),
        })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("falls back to INBOX for broken settings and reports expiry before any folder completed", async () => {
        const { service, imap, context } = await build({ config: "broken" })
        imap.pull.mockResolvedValue({ folders: [], expired: true })

        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            note: IMAP_CONNECTION_TEXT.stoppedEarly,
            meta: {},
        })
        expect(imap.pull).toHaveBeenCalledWith(login, {
            folders: [{ path: "INBOX", cursor: null }],
            since: new Date("2026-09-14T08:30:00.000Z"),
            isExpired: context.isExpired,
            deliver: expect.any(Function),
        })
    })

    it("refuses an invalid saved credential before reading the clock or contacting the client", async () => {
        const { service, imap, clock, context } = await build()
        const readNow = jest.spyOn(clock, "now")

        await expect(service.sync({ ...context, credential: "broken" })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: IMAP_CONNECTION_TEXT.credentialMissing },
        })
        expect(readNow).not.toHaveBeenCalled()
        expect(imap.pull).not.toHaveBeenCalled()
    })

    it("propagates a rejected client pull without writing rows", async () => {
        const { service, imap, context } = await build()
        const failure = new DataHubError({ code: DataHubErrorCode.SyncFailed })
        imap.pull.mockRejectedValue(failure)

        await expect(service.sync(context)).rejects.toBe(failure)
        expect(context.upsert).not.toHaveBeenCalled()
    })
})
