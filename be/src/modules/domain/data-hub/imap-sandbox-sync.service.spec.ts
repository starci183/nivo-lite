import { readFileSync } from "node:fs"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import type { DataRecordInput } from "@modules/domain/data-records"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import type { ImapClient } from "@modules/integrations/data-sources"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import type { DataConnection, DataSyncContext } from "./data-hub.contracts"
import { DataSyncTriggerService } from "./data-sync-trigger.service"
import { IMAP_SANDBOX_CASES, IMAP_SANDBOX_CATALOGUE, imapRowsOf } from "./imap-sandbox.catalogue"
import { ImapSandboxSyncService } from "./imap-sandbox-sync.service"
import { ImapSyncService } from "./imap-sync.service"
import { DataConnectorRegistryService } from "./data-connector-registry.service"

const ACCOUNT = sandboxAccount({ id: "imap-sbx", workspaceId: "ws-1", provider: "imap" })
const CONNECTION: DataConnection = {
    id: "imap-sbx",
    workspaceId: "ws-1",
    provider: "imap",
    name: "Sandbox mailbox",
    status: "connected",
    lastError: null,
    meta: {},
    everyMinutes: 15,
    lastSyncAt: null,
    sandbox: true,
}
const NOW = "2026-11-14T10:00:00.000Z"

/** One member of a kept row's value (the intake takes the value as an object of the declared type). */
const fieldOf = (value: object, key: string): unknown => Reflect.get(value, key)

/** The real keep path of the live pull over a doubled intake: every input is a new row. */
const setup = () => {
    const { sandbox, store } = sandboxServiceOf(ACCOUNT)
    const imap = mock<ImapClient>()
    const intake = mock<AccountDataIntakeService>()
    intake.write.mockImplementation(async (_tx, _id, inputs) => ({
        owner: { provider: "imap", connectionId: "imap-sbx", workspaceId: "ws-1" },
        rows: inputs.map((input) => ({ type: "imap.mail", key: String(fieldOf(input.value, "externalId")), id: `row-${String(fieldOf(input.value, "externalId"))}`, isNew: true })),
    }))
    const mails = mock<DataSyncTriggerService>()
    mails.deliverMails.mockResolvedValue(undefined)
    const entityManager = mockEntityManager()
    fakeTransaction(entityManager)
    const live = new ImapSyncService(imap, new FakeClock(NOW), entityManager, intake, mails)
    const service = new ImapSandboxSyncService(sandbox, new FakeClock(NOW))
    const contextOf = (connection: DataConnection = CONNECTION): DataSyncContext => ({
        connection,
        credential: "",
        isExpired: () => false,
        upsert: (_entity, rows: ReadonlyArray<DataRecordInput>) => live.keep(connection.id, rows),
    })
    return { sandbox, store, service, imap, intake, mails, live, contextOf }
}

const keptIdsOf = (intake: ReturnType<typeof setup>["intake"]): ReadonlyArray<string> =>
    intake.write.mock.calls.flatMap((call) => call[2].map((input) => String(fieldOf(input.value, "externalId"))))

describe("ImapSandboxSyncService", () => {
    it("IMAP-1 is the default: the first poll delivers one support request through the live keep path, with the INBOX cursor", async () => {
        const { service, contextOf, intake, imap, mails } = setup()

        await expect(service.sync(contextOf())).resolves.toEqual({ rows: 1, meta: { "cursor:INBOX": "1:1" } })

        expect(intake.write).toHaveBeenCalledWith(expect.anything(), "imap-sbx", [
            {
                type: "imap.mail",
                value: expect.objectContaining({
                    externalId: "INBOX:1:1",
                    folder: "INBOX",
                    uid: 1,
                    date: NOW,
                    subject: "Website bi loi khi thanh toan",
                    messageId: "<sbx-imap-1@sandbox.nivo>",
                    from: [{ name: "Nguyen Van An", address: "an.nguyen@example.com" }],
                }),
            },
        ])
        expect(mails.deliverMails).toHaveBeenCalledTimes(1)
        expect(imap.pull).not.toHaveBeenCalled()
    })

    it.each([
        ["IMAP-2", 1, "Hoi gia goi dich vu", null],
        ["IMAP-3", 1, "Re: Gia han ten mien shop-cua-cuong.vn", "<renewal-notice-1@sandbox.nivo>"],
        ["IMAP-4", 1, "Re: Gia han ten mien shop-cua-dung.vn", "<renewal-notice-1@sandbox.nivo>"],
        ["IMAP-5", 1, "Hop tac quang cao", null],
        ["IMAP-6", 1, "Re: Gia han ten mien shop-cua-em.vn", "<renewal-notice-1@sandbox.nivo>"],
        ["IMAP-7", 30, "Hoi don hang so 1", null],
    ])("%s delivers its set when the account picked it", async (caseId, count, subject, inReplyTo) => {
        const { sandbox, service, contextOf, intake } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", caseId)

        await expect(service.sync(contextOf())).resolves.toEqual({ rows: count, meta: { "cursor:INBOX": `1:${count}` } })

        const first = intake.write.mock.calls[0]?.[2][0]?.value
        expect(first).toMatchObject({ subject })
        expect(first === undefined ? null : (fieldOf(first, "inReplyTo") ?? null)).toBe(inReplyTo)
        expect(keptIdsOf(intake)).toHaveLength(count)
    })

    it("IMAP-3 says yes, IMAP-4 says no, IMAP-6 means two things", () => {
        const text = (id: string) => String(imapRowsOf(id, 1, new Date(NOW))[0]?.data.text)

        expect(text("IMAP-3")).toContain("Dong y")
        expect(text("IMAP-4")).toContain("khong gia han")
        expect(text("IMAP-6")).toContain("Dong y")
        expect(text("IMAP-6")).toContain("hosting")
    })

    it("IMAP-7 is thirty distinct mails with running UIDs and dates a minute apart, the last at the moment of the poll", () => {
        const rows = imapRowsOf("IMAP-7", 5, new Date(NOW))

        expect(rows).toHaveLength(30)
        expect(new Set(rows.map((row) => row.externalId)).size).toBe(30)
        expect(rows[0]?.externalId).toBe("INBOX:1:5")
        expect(rows[29]?.externalId).toBe("INBOX:1:34")
        expect(rows[29]?.occurredAt).toEqual(new Date(NOW))
        expect(rows[0]?.occurredAt).toEqual(new Date("2026-11-14T09:31:00.000Z"))
    })

    it("a second poll delivers nothing again: no duplicates, the same cursor is not moved", async () => {
        const { service, contextOf, intake } = setup()

        await service.sync(contextOf())
        await expect(service.sync(contextOf())).resolves.toEqual({ rows: 0, meta: {} })

        expect(keptIdsOf(intake)).toEqual(["INBOX:1:1"])
    })

    it("a later pull of the next set adds new mails with UIDs after the first set's", async () => {
        const { sandbox, service, contextOf, intake } = setup()

        await service.sync(contextOf())
        await sandbox.setNextCase(ACCOUNT, "pull", "IMAP-2")
        await expect(service.sync(contextOf())).resolves.toEqual({ rows: 1, meta: { "cursor:INBOX": "1:2" } })
        await sandbox.setNextCase(ACCOUNT, "pull", "IMAP-7")
        await expect(service.sync(contextOf())).resolves.toEqual({ rows: 30, meta: { "cursor:INBOX": "1:32" } })
        await sandbox.setNextCase(ACCOUNT, "pull", "IMAP-1")
        await expect(service.sync(contextOf())).resolves.toEqual({ rows: 0, meta: {} })

        const ids = keptIdsOf(intake)
        expect(ids).toHaveLength(32)
        expect(new Set(ids).size).toBe(32)
        expect(ids[1]).toBe("INBOX:1:2")
    })

    it("logs exactly one call per poll, also the one that delivered nothing", async () => {
        const { sandbox, service, contextOf } = setup()

        await service.sync(contextOf())
        await service.sync(contextOf())

        const calls = await sandbox.calls(ACCOUNT, "pull")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: "INBOX", result: { outcome: "answered", value: { rows: 1 } } })
    })

    it("is deterministic: a fresh account delivers the same rows", async () => {
        const first = setup()
        const second = setup()

        await first.service.sync(first.contextOf())
        await second.service.sync(second.contextOf())

        expect(second.intake.write.mock.calls[0]?.[2]).toEqual(first.intake.write.mock.calls[0]?.[2])
    })

    it("refuses a live account and a switched-off sandbox, before anything is kept", async () => {
        const { service, contextOf, intake } = setup()
        const off = new ImapSandboxSyncService(sandboxServiceOff(ACCOUNT).sandbox, new FakeClock(NOW))
        const live: DataConnection = { ...CONNECTION }
        delete (live as { sandbox?: true }).sandbox

        await expect(service.sync(contextOf(live))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.sync(contextOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        expect(intake.write).not.toHaveBeenCalled()
    })

    it("has unique IMAP-<n> ids, exactly one default case, all for the pull operation", () => {
        expect(IMAP_SANDBOX_CASES.map((one) => one.id)).toEqual(["IMAP-1", "IMAP-2", "IMAP-3", "IMAP-4", "IMAP-5", "IMAP-6", "IMAP-7"])
        expect(IMAP_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["IMAP-1"])
        expect(IMAP_SANDBOX_CASES.every((one) => one.operation === "pull")).toBe(true)
        expect(IMAP_SANDBOX_CATALOGUE.provider).toBe("imap")
    })

    it("is the sandbox twin the registry answers for a sandbox mailbox, and the live connector for a live one", () => {
        const { service, live } = setup()
        const registry = new DataConnectorRegistryService()
        registry.register({ live, sandbox: service })

        expect(registry.portFor({ provider: "imap", sandbox: true })).toBe(service)
        expect(registry.portFor({ provider: "imap", sandbox: false })).toBe(live)
    })

    it("has zero network: the sandbox frame and the clock only, no IMAP client, no credential, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        const catalogue = readFileSync(__filename.replace("-sync.service.spec.ts", ".catalogue.ts"), "utf8")

        expect(ImapSandboxSyncService.length).toBe(2)
        for (const text of [source, catalogue]) {
            expect(text).not.toContain("@modules/integrations")
            expect(text).not.toContain("http")
            expect(text).not.toContain("parseCredential")
            expect(text).not.toContain("Date.now")
        }
    })
})
