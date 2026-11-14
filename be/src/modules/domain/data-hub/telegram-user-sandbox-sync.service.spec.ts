import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import type { DataEntity, DataRecordInput } from "@modules/domain/data-records"
import { DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { TELEGRAM_NOT_CONFIGURED_MESSAGE, TELEGRAM_REVOKED_MESSAGE } from "@modules/integrations/telegram-user"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { DataConnectorRegistryService } from "./data-connector-registry.service"
import type { DataConnection, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { TELEGRAM_WIZARD_TEXT } from "./messages/telegram-user-wizard.messages"
import {
    TELEGRAM_USER_CASE,
    TELEGRAM_USER_PER_CHAT_LIMIT,
    TELEGRAM_USER_SANDBOX_CASES,
    TELEGRAM_USER_SANDBOX_CATALOGUE,
    TELEGRAM_USER_SANDBOX_CHATS,
} from "./telegram-user-sandbox.catalogue"
import { TelegramUserSandboxSyncService } from "./telegram-user-sandbox-sync.service"

const ACCOUNT = sandboxAccount({ id: "tg-sbx", workspaceId: "ws-1", provider: "telegram_user" })
const CONNECTION: DataConnection = {
    id: "tg-sbx",
    workspaceId: "ws-1",
    provider: "telegram_user",
    name: "Sandbox Telegram",
    status: "connected",
    lastError: null,
    meta: {},
    everyMinutes: 15,
    lastSyncAt: null,
    sandbox: true,
}
const GROUP = "-1001000000001"
const PRIVATE = "1000000001"
const BUSY = "-1001000000002"

/** One account's pulls: the keep path is a hub double, and the result's cursors are merged into the connection's meta as `markSynced` does. */
const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    const kept: Array<{ readonly entity: DataEntity; readonly rows: ReadonlyArray<DataRecordInput> }> = []
    let connection = CONNECTION
    const service = new TelegramUserSandboxSyncService(sandbox)
    const contextOf = (current: DataConnection): DataSyncContext => ({
        connection: current,
        credential: "",
        isExpired: () => false,
        upsert: (entity, rows) => {
            kept.push({ entity, rows })
            return Promise.resolve(rows.length)
        },
    })
    const pull = async (): Promise<DataSyncResult> => {
        const result = await service.sync(contextOf(connection))
        connection = { ...connection, meta: { ...connection.meta, ...result.meta } }
        return result
    }
    const idsOf = (): ReadonlyArray<string> => kept.flatMap((one) => one.rows.map((row) => row.externalId))
    return { sandbox, service, pull, kept, idsOf, contextOf }
}

describe("TelegramUserSandboxSyncService", () => {
    it("TELEGRAM_USER-1 is the default: the first pull brings the group's two lines and the private chat's text and picture as message rows, and moves each chat's cursor", async () => {
        const { pull, idsOf, kept } = setup()

        await expect(pull()).resolves.toEqual({ rows: 4, meta: { [`cursor:${GROUP}`]: "2", [`cursor:${PRIVATE}`]: "2" } })

        expect(idsOf()).toEqual([`${GROUP}:1`, `${GROUP}:2`, `${PRIVATE}:1`, `${PRIVATE}:2`])
        expect(kept.every((one) => one.entity === "message")).toBe(true)
    })

    it("a row is made by the live mapping: the title is the text, a picture-only message is titled as an attachment, the data keeps the chat, sender and reply", async () => {
        const { pull, kept } = setup()

        await pull()

        const rows = kept.flatMap((one) => one.rows)
        expect(rows[1]).toEqual({
            externalId: `${GROUP}:2`,
            title: "Con mau den size M khong a?",
            occurredAt: new Date("2026-11-10T03:02:00.000Z"),
            data: {
                chatId: GROUP,
                chatTitle: "Nhom khach quen",
                senderName: "Chi Hoa",
                text: "Con mau den size M khong a?",
                replyToId: 1,
                hasMedia: false,
            },
        })
        expect(rows[3]).toMatchObject({ title: TELEGRAM_WIZARD_TEXT.attachment, data: { text: "", hasMedia: true } })
    })

    it("a second pull brings nothing (the cursors hold) and answers no meta", async () => {
        const { pull, idsOf } = setup()

        await pull()
        await expect(pull()).resolves.toEqual({ rows: 0 })

        expect(idsOf()).toHaveLength(4)
    })

    it("TELEGRAM_USER-2: after a first read only the lines that came after the cursors are brought", async () => {
        const { sandbox, pull, idsOf } = setup()
        await pull()
        await sandbox.setNextCase(ACCOUNT, "pull", TELEGRAM_USER_CASE.newLines)

        await expect(pull()).resolves.toEqual({ rows: 3, meta: { [`cursor:${GROUP}`]: "3", [`cursor:${PRIVATE}`]: "4" } })

        expect(idsOf().slice(4)).toEqual([`${GROUP}:3`, `${PRIVATE}:3`, `${PRIVATE}:4`])
    })

    it("TELEGRAM_USER-3: a busy group gives 200 lines and says older lines are left, the next pull takes the other 50 and says nothing", async () => {
        const { sandbox, pull, kept } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", TELEGRAM_USER_CASE.busyGroup)

        const first = await pull()
        const second = await pull()

        expect(first.note).toBe(TELEGRAM_WIZARD_TEXT.olderLeft(1))
        expect(first.meta?.[`cursor:${BUSY}`]).toBe(String(TELEGRAM_USER_PER_CHAT_LIMIT))
        expect(second.note).toBeUndefined()
        expect(second.meta).toEqual({ [`cursor:${BUSY}`]: "250" })
        expect(second.rows).toBe(50)
        const busy = kept.flatMap((one) => one.rows).filter((row) => row.data.chatId === BUSY)
        expect(busy).toHaveLength(250)
        expect(new Set(busy.map((row) => row.externalId)).size).toBe(250)
    })

    it.each([
        [TELEGRAM_USER_CASE.sessionRevoked, DataSourcesErrorCode.Rejected, TELEGRAM_REVOKED_MESSAGE],
        [TELEGRAM_USER_CASE.notConfigured, DataSourcesErrorCode.Unavailable, TELEGRAM_NOT_CONFIGURED_MESSAGE],
    ])("%s throws the data-sources error the live client throws (%s) with the live sentence, nothing kept", async (caseId, code, detail) => {
        const { sandbox, service, contextOf, kept } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", caseId)

        const failure = await service.sync(contextOf(CONNECTION)).then(() => null, (cause: unknown) => cause)

        expect(failure).toMatchObject({ code, params: { detail } })
        expect(kept).toEqual([])
    })

    it("TELEGRAM_USER-6: Telegram not answering is the unavailable data-sources error, nothing kept", async () => {
        const { sandbox, service, contextOf, kept } = setup()
        await sandbox.setNextCase(ACCOUNT, "pull", TELEGRAM_USER_CASE.unreachable)

        const failure = await service.sync(contextOf(CONNECTION)).then(() => null, (cause: unknown) => cause)

        expect(failure).toMatchObject({ code: DataSourcesErrorCode.Unavailable })
        expect(kept).toEqual([])
    })

    it("stops early when the run's time budget is spent, keeping what was read", async () => {
        const { service, contextOf, kept } = setup()
        let reads = 0
        const context = { ...contextOf(CONNECTION), isExpired: () => (reads += 1) > 1 }

        const result = await service.sync(context)

        expect(result.rows).toBe(2)
        expect(kept).toHaveLength(1)
    })

    it("logs exactly one call per pull, also the one that brought nothing", async () => {
        const { sandbox, pull } = setup()

        await pull()
        await pull()

        const calls = await sandbox.calls(ACCOUNT, "pull")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ result: { outcome: "answered", value: { rows: 4 } } })
    })

    it("is deterministic: a fresh account brings the same rows", async () => {
        const first = setup()
        const second = setup()

        await first.pull()
        await second.pull()

        expect(second.kept).toEqual(first.kept)
    })

    it("refuses a live account and a switched-off sandbox, before anything is kept", async () => {
        const { service, contextOf, kept } = setup()
        const off = new TelegramUserSandboxSyncService(sandboxServiceOff(ACCOUNT).sandbox)
        const live: DataConnection = { ...CONNECTION }
        delete (live as { sandbox?: true }).sandbox

        await expect(service.sync(contextOf(live))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.sync(contextOf(CONNECTION))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        expect(kept).toEqual([])
    })

    it("is the twin the registry answers for a sandbox Telegram account, and the live connector for a live one", () => {
        const { service } = setup()
        const live = { provider: "telegram_user" as const, sync: jest.fn() }
        const registry = new DataConnectorRegistryService()
        registry.register({ live, sandbox: service })

        expect(registry.portFor({ provider: "telegram_user", sandbox: true })).toBe(service)
        expect(registry.portFor({ provider: "telegram_user", sandbox: false })).toBe(live)
    })

    it("has unique TELEGRAM_USER-<n> ids 1..6, exactly one default case, all for the pull operation", () => {
        expect(TELEGRAM_USER_SANDBOX_CASES.map((one) => one.id)).toEqual(Array.from({ length: 6 }, (_, index) => `TELEGRAM_USER-${String(index + 1)}`))
        expect(TELEGRAM_USER_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["TELEGRAM_USER-1"])
        expect(TELEGRAM_USER_SANDBOX_CASES.every((one) => one.operation === "pull" && one.inbound === undefined && one.label.length > 0)).toBe(true)
        expect(TELEGRAM_USER_SANDBOX_CATALOGUE.provider).toBe("telegram_user")
        expect(Object.values(TELEGRAM_USER_CASE)).toEqual(TELEGRAM_USER_SANDBOX_CASES.map((one) => one.id))
    })

    it("has chats whose message ids are unique and in order, and a busy group longer than one pull", () => {
        for (const chat of TELEGRAM_USER_SANDBOX_CHATS) {
            const ids = chat.messages.map((message) => message.id)
            expect(ids).toEqual(ids.toSorted((left, right) => left - right))
            expect(new Set(ids).size).toBe(ids.length)
        }
        expect(TELEGRAM_USER_SANDBOX_CHATS.find((chat) => chat.id === BUSY)?.messages.length).toBeGreaterThan(TELEGRAM_USER_PER_CHAT_LIMIT)
    })

    it("has zero network: the sandbox frame only, no Telegram client, no session, no clock, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        const catalogue = readFileSync(__filename.replace("-sync.service.spec.ts", ".catalogue.ts"), "utf8")

        expect(TelegramUserSandboxSyncService.length).toBe(1)
        for (const text of [source, catalogue]) {
            expect(text).not.toContain("@modules/integrations")
            expect(text).not.toContain("http")
            expect(text).not.toContain("parseCredential")
            expect(text).not.toContain("Date.now")
        }
    })
})
