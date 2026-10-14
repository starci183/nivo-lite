import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import {
    TELEGRAM_NOT_CONFIGURED_MESSAGE,
    TELEGRAM_REVOKED_MESSAGE,
    TELEGRAM_USER,
} from "@modules/integrations/telegram-user"
import type { TelegramChatChoice, TelegramUserClient } from "@modules/integrations/telegram-user"
import { CLOCK } from "@modules/platform/clock"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { TELEGRAM_WIZARD_TEXT as TEXT } from "./messages/telegram-user-wizard.messages"
import type { PickedChat, SaveTelegramSetupInput, TelegramLoginState } from "./telegram-user-wizard.contracts"
import { TelegramUserWizardService } from "./telegram-user-wizard.service"

describe("TelegramUserWizardService", () => {
    const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
    const now = new Date("2026-10-14T00:00:00.000Z")
    const login: TelegramLoginState = {
        stage: "code",
        phone: "+84912345678",
        phoneCodeHash: "code-hash",
        session: "pending-session",
        startedAt: 1791935940000,
    }
    const connection: DataConnection = {
        id: "telegram-1",
        workspaceId: "workspace-1",
        provider: "telegram_user",
        name: "Personal Telegram",
        status: "pending",
        lastError: null,
        meta: { consentAt: "2026-10-13T00:00:00.000Z", "cursor:101": "42" },
        everyMinutes: null,
        lastSyncAt: null,
    }
    const draft = { name: "  Personal Telegram  ", phone: "0912 345 678", consent: true }
    const setup: SaveTelegramSetupInput = {
        connectionId: "telegram-1",
        chats: [{ id: "101", title: "Team", kind: "group" }],
        sinceDays: 30,
        everyMinutes: 15,
    }
    const codeEntry = { connectionId: "telegram-1", code: "12345" }
    const passwordEntry = { connectionId: "telegram-1", password: "typed-password" }
    const invalidChats: ReadonlyArray<PickedChat> = [{ id: "invalid", title: "Invalid", kind: "group" }]
    const oversizedChats = Array.from({ length: 51 }, (): PickedChat => ({ id: "101", title: "Team", kind: "group" }))
    const expiredCredential = JSON.stringify({ login: { ...login, startedAt: 0 } })
    const initialState = { name: "Personal Telegram", config: null, everyMinutes: null, consent: true }
    const sentCode = { phoneCodeHash: "sent-hash", session: "sent-session", viaApp: true }
    const finalCredential = '{"session":"final-session"}'
    const startedCredential =
        '{"login":{"stage":"code","phone":"+84912345678","phoneCodeHash":"sent-hash","session":"sent-session","startedAt":1791936000000}}'
    const rejectsInvalid = (operation: Promise<unknown>, detail: string) =>
        expect(operation).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail } })
    const build = async () => {
        const hub = mock<DataHubService>()
        const connections = mock<ConnectionsService>()
        const telegram = mock<TelegramUserClient>()
        const clock = new FakeClock(now)
        hub.own.mockResolvedValue(connection)
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login }))
        hub.create.mockResolvedValue("telegram-new")
        telegram.configured.mockReturnValue(true)
        telegram.sendCode.mockResolvedValue(sentCode)
        telegram.resendCode.mockResolvedValue({ phoneCodeHash: "resent-hash", session: "resent-session" })
        telegram.signIn.mockResolvedValue({
            kind: "ready",
            session: "final-session",
            account: { displayName: "  Alice  ", username: "alice" },
        })
        telegram.checkPassword.mockResolvedValue({
            session: "final-session",
            account: { displayName: "", username: null },
        })
        const moduleRef = await Test.createTestingModule({
            providers: [
                TelegramUserWizardService,
                { provide: DataHubService, useValue: hub },
                { provide: ConnectionsService, useValue: connections },
                { provide: TELEGRAM_USER, useValue: telegram },
                { provide: CLOCK, useValue: clock },
            ],
        }).compile()
        return { service: moduleRef.get(TelegramUserWizardService), hub, connections, telegram, clock }
    }
    type TelegramFailureCase = [
        "sendCode" | "resendCode" | "signIn" | "checkPassword" | "listDialogs",
        (service: TelegramUserWizardService) => Promise<unknown>,
    ]

    it.each([true, false])("reports deployment readiness as %s after checking ownership", async (configured) => {
        const { service, hub, telegram } = await build()
        telegram.configured.mockReturnValue(configured)
        await expect(service.ready(actor)).resolves.toBe(configured)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.configured).toHaveBeenCalledWith()
    })

    it("stops before checking Telegram when ownership is denied", async () => {
        const { service, hub, telegram } = await build()
        const cause = new DataHubError({ code: DataHubErrorCode.NotFound })
        hub.owner.mockRejectedValue(cause)
        await expect(service.ready(actor)).rejects.toBe(cause)
        expect(telegram.configured).not.toHaveBeenCalled()
    })

    it.each(["code", "password"])("loads the pending %s stage at the expiration boundary", async (stage) => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: { ...login, stage, startedAt: 1791935400000 } }))
        await expect(service.load(actor, "telegram-1")).resolves.toEqual({ ...initialState, status: "pending", stage })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "telegram-1", "telegram_user")
        expect(hub.credentialOf).toHaveBeenCalledWith("telegram-1")
    })

    it.each([
        { name: "missing", credential: null, clockCalls: 0 },
        { name: "expired", credential: expiredCredential, clockCalls: 1 },
    ])("refuses to load a $name pending login", async ({ credential, clockCalls }) => {
        const { service, hub, clock } = await build()
        const clockSpy = jest.spyOn(clock, "now")
        hub.credentialOf.mockResolvedValue(credential)
        await rejectsInvalid(service.load(actor, "telegram-1"), TEXT.expired)
        expect(clockSpy).toHaveBeenCalledTimes(clockCalls)
    })

    it.each<[DataConnection["status"], string]>([
        ["connected", "connected"],
        ["error", "error"],
        ["disconnected", "connected"],
    ])("loads a %s account with saved picks without expiring its old login", async (status, expectedStatus) => {
        const { service, hub, clock } = await build()
        const clockSpy = jest.spyOn(clock, "now")
        hub.own.mockResolvedValue({
            ...connection,
            status,
            meta: { config: '{"chats":[{"id":"101","title":"Team","kind":"group"}],"sinceDays":30}' },
            everyMinutes: 60,
        })
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: { ...login, startedAt: 0 } }))
        await expect(service.load(actor, "telegram-1")).resolves.toEqual({
            name: "Personal Telegram",
            status: expectedStatus,
            stage: "ready",
            config: { chats: [{ id: "101", title: "Team", kind: "group" }], sinceDays: 30 },
            everyMinutes: 60,
            consent: false,
        })
        expect(clockSpy).not.toHaveBeenCalled()
    })

    it.each([
        { connectionId: undefined, name: draft.name, expectedName: "Personal Telegram", viaApp: true },
        { connectionId: null, name: "A".repeat(81), expectedName: "A".repeat(80), viaApp: false },
    ])("creates a pending connection for id $connectionId with a cleaned name and phone", async (input) => {
        const { service, hub, telegram } = await build()
        telegram.sendCode.mockResolvedValue({ ...sentCode, viaApp: input.viaApp })
        await expect(
            service.startLogin(actor, { ...draft, name: input.name, connectionId: input.connectionId }),
        ).resolves.toEqual({ connectionId: "telegram-new", viaApp: input.viaApp })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.sendCode).toHaveBeenCalledWith("+84912345678")
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "telegram_user",
            name: input.expectedName,
            meta: { consentAt: "2026-10-14T00:00:00.000Z" },
            credential: startedCredential,
            everyMinutes: null,
            status: "pending",
        })
        expect(hub.saveCredential).not.toHaveBeenCalled()
    })

    it("reuses a pending connection and preserves its facts when correcting the phone", async () => {
        const { service, hub, connections, telegram } = await build()
        await expect(
            service.startLogin(actor, { ...draft, connectionId: "telegram-1", phone: "+12025550123" }),
        ).resolves.toEqual({ connectionId: "telegram-1", viaApp: true })
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "telegram-1", "telegram_user")
        expect(telegram.sendCode).toHaveBeenCalledWith("+12025550123")
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "telegram-1",
            '{"login":{"stage":"code","phone":"+12025550123","phoneCodeHash":"sent-hash","session":"sent-session","startedAt":1791936000000}}',
        )
        expect(connections.patch).toHaveBeenCalledWith("workspace-1", "telegram-1", {
            name: "Personal Telegram",
            meta: { consentAt: "2026-10-14T00:00:00.000Z", "cursor:101": "42" },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it.each([
        { name: "unconfigured Telegram", configured: false, input: draft, detail: TELEGRAM_NOT_CONFIGURED_MESSAGE },
        { name: "missing consent", configured: true, input: { ...draft, consent: false }, detail: TEXT.consent },
        { name: "blank name", configured: true, input: { ...draft, name: "  " }, detail: TEXT.nameRequired },
        { name: "invalid phone", configured: true, input: { ...draft, phone: "invalid" }, detail: TEXT.phoneInvalid },
        {
            name: "connected account",
            configured: true,
            input: { ...draft, connectionId: "telegram-1" },
            detail: TEXT.alreadyLoggedIn,
        },
    ])("refuses to start login with $name", async ({ configured, input, detail }) => {
        const { service, hub, telegram } = await build()
        telegram.configured.mockReturnValue(configured)
        hub.own.mockResolvedValue({ ...connection, status: "connected" })
        await rejectsInvalid(service.startLogin(actor, input), detail)
        expect(telegram.sendCode).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("resends a code and retains the original login lifetime", async () => {
        const { service, hub, telegram } = await build()
        const passwordLogin = { ...login, stage: "password" }
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: passwordLogin }))
        await expect(service.resendCode(actor, "telegram-1")).resolves.toBeUndefined()
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.resendCode).toHaveBeenCalledWith(passwordLogin)
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "telegram-1",
            '{"login":{"stage":"code","phone":"+84912345678","phoneCodeHash":"resent-hash","session":"resent-session","startedAt":1791935940000}}',
        )
    })

    it.each<[string, DataConnection["status"], string, string]>([
        ["connected", "connected", JSON.stringify({ login }), TEXT.noPendingLogin],
        ["missing", "pending", "{}", TEXT.noPendingLogin],
        ["expired", "pending", expiredCredential, TEXT.expired],
    ])("refuses to resend a code for a %s login", async (_, status, credential, detail) => {
        const { service, hub, telegram } = await build()
        hub.own.mockResolvedValue({ ...connection, status })
        hub.credentialOf.mockResolvedValue(credential)
        await rejectsInvalid(service.resendCode(actor, "telegram-1"), detail)
        expect(telegram.resendCode).not.toHaveBeenCalled()
    })

    it("strips code separators and stores the password stage when Telegram requests it", async () => {
        const { service, hub, connections, telegram } = await build()
        telegram.signIn.mockResolvedValue({ kind: "password", session: "password-session" })
        await expect(service.submitCode(actor, { connectionId: "telegram-1", code: "12-34" })).resolves.toEqual({
            stage: "password",
        })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.signIn).toHaveBeenCalledWith({ ...login, code: "1234" })
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "telegram-1",
            '{"login":{"stage":"password","phone":"+84912345678","phoneCodeHash":"code-hash","session":"password-session","startedAt":1791935940000}}',
        )
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("finishes a code login with only the final session and masked account label", async () => {
        const { service, hub, connections, telegram } = await build()
        await expect(service.submitCode(actor, { connectionId: "telegram-1", code: "12345678" })).resolves.toEqual({
            stage: "ready",
        })
        expect(telegram.signIn).toHaveBeenCalledWith({ ...login, code: "12345678" })
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", finalCredential)
        expect(connections.patch).toHaveBeenCalledWith("workspace-1", "telegram-1", {
            meta: { ...connection.meta, account: "Alice (@alice) \u2026678" },
        })
    })

    it.each(["1-2-3", "123456789"])("refuses a code with an invalid digit count: %s", async (code) => {
        const { service, hub, telegram } = await build()
        await rejectsInvalid(service.submitCode(actor, { connectionId: "telegram-1", code }), TEXT.codeLength)
        expect(telegram.signIn).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
    })

    it.each([
        { stage: "code", password: "typed-password", detail: TEXT.passwordNotNeeded },
        { stage: "password", password: "", detail: TEXT.passwordRequired },
    ])("refuses password submission in stage $stage with password '$password'", async ({ stage, password, detail }) => {
        const { service, hub, telegram } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: { ...login, stage } }))
        await rejectsInvalid(service.submitPassword(actor, { connectionId: "telegram-1", password }), detail)
        expect(telegram.checkPassword).not.toHaveBeenCalled()
    })

    it("finishes two-step login without retaining the submitted password", async () => {
        const { service, hub, connections, telegram } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: { ...login, stage: "password" } }))
        await expect(
            service.submitPassword(actor, { connectionId: "telegram-1", password: " typed-password " }),
        ).resolves.toEqual({ stage: "ready" })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.checkPassword).toHaveBeenCalledWith({
            session: "pending-session",
            password: " typed-password ",
        })
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", finalCredential)
        expect(connections.patch).toHaveBeenCalledWith("workspace-1", "telegram-1", {
            meta: { ...connection.meta, account: "Telegram \u2026678" },
        })
    })

    it.each<[DataConnection["status"], ReadonlyArray<ReadonlyArray<string>>]>([
        ["pending", [["workspace-1", "telegram-1"]]],
        ["connected", []],
    ])("removes only pending connections on cancelling %s", async (status, calls) => {
        const { service, hub } = await build()
        hub.own.mockResolvedValue({ ...connection, status })
        await expect(service.cancelLogin(actor, "telegram-1")).resolves.toBeUndefined()
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "telegram-1", "telegram_user")
        expect(hub.remove.mock.calls).toEqual(calls)
        expect(hub.credentialOf).not.toHaveBeenCalled()
    })

    it("lists recent dialogs with a limit of one hundred", async () => {
        const { service, hub, telegram } = await build()
        const chats: ReadonlyArray<TelegramChatChoice> = [{ id: "101", title: "Team", kind: "group", unread: 2 }]
        hub.credentialOf.mockResolvedValue(finalCredential)
        telegram.listDialogs.mockResolvedValue(chats)
        await expect(service.listChats(actor, "telegram-1")).resolves.toEqual(chats)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "telegram-1", "telegram_user")
        expect(telegram.listDialogs).toHaveBeenCalledWith("final-session", 100)
    })

    it("refuses to list chats when the final session is missing", async () => {
        const { service, telegram } = await build()
        await rejectsInvalid(service.listChats(actor, "telegram-1"), TELEGRAM_REVOKED_MESSAGE)
        expect(telegram.listDialogs).not.toHaveBeenCalled()
    })

    it.each<[number | null | undefined, number, number, number | null]>([
        [15, 30, 30, 15],
        [undefined, 90, 7, null],
        [null, 30, 30, null],
        [60, 30, 30, 60],
    ])(
        "saves cleaned picks for schedule %s and first window %s",
        async (everyMinutes, sinceDays, expectedDays, expectedSchedule) => {
            const { service, hub } = await build()
            const chats: ReadonlyArray<PickedChat> = [
                { id: "101", title: "Team", kind: "group" },
                { id: "101", title: "Duplicate", kind: "user" },
                { id: "invalid", title: "Invalid", kind: "channel" },
                { id: "-202", title: "Updates", kind: "channel" },
            ]
            const expectedChats = [
                { id: "101", title: "Team", kind: "group" },
                { id: "-202", title: "Updates", kind: "channel" },
            ]
            hub.credentialOf.mockResolvedValue(finalCredential)
            await expect(
                service.saveSetup(actor, { ...setup, chats, everyMinutes, sinceDays }),
            ).resolves.toBeUndefined()
            expect(hub.owner).toHaveBeenCalledWith(actor)
            expect(hub.own).toHaveBeenCalledWith("workspace-1", "telegram-1", "telegram_user")
            expect(hub.update).toHaveBeenCalledWith("workspace-1", "telegram-1", {
                name: "Personal Telegram",
                meta: {
                    ...connection.meta,
                    config: JSON.stringify({ chats: expectedChats, sinceDays: expectedDays }),
                    summary: TEXT.summary(2),
                },
                everyMinutes: expectedSchedule,
            })
        },
    )

    it("accepts exactly fifty chats with an hourly schedule", async () => {
        const { service, hub } = await build()
        const chats = Array.from({ length: 50 }, (_, index): PickedChat => ({
            id: String(index + 1),
            title: "Chat",
            kind: "group",
        }))
        hub.credentialOf.mockResolvedValue(finalCredential)
        await expect(service.saveSetup(actor, { ...setup, chats, everyMinutes: 60 })).resolves.toBeUndefined()
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "telegram-1", {
            name: "Personal Telegram",
            meta: { ...connection.meta, config: JSON.stringify({ chats, sinceDays: 30 }), summary: TEXT.summary(50) },
            everyMinutes: 60,
        })
    })

    it.each<[string, string, SaveTelegramSetupInput, string]>([
        ["missing session", "{}", setup, TEXT.notLoggedIn],
        ["unsupported schedule", finalCredential, { ...setup, everyMinutes: 30 }, TEXT.scheduleInvalid],
        ["over fifty picks", finalCredential, { ...setup, chats: oversizedChats }, TEXT.tooManyChats(50)],
        ["empty picks", finalCredential, { ...setup, chats: [] }, TEXT.pickOne],
        ["invalid picks", finalCredential, { ...setup, chats: invalidChats }, TEXT.pickOne],
    ])("refuses setup with %s", async (_, credential, input, detail) => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(credential)
        await rejectsInvalid(service.saveSetup(actor, input), detail)
        expect(hub.update).not.toHaveBeenCalled()
    })

    it.each<TelegramFailureCase>([
        ["sendCode", (service) => service.startLogin(actor, draft)],
        ["resendCode", (service) => service.resendCode(actor, "telegram-1")],
        ["signIn", (service) => service.submitCode(actor, codeEntry)],
        ["checkPassword", (service) => service.submitPassword(actor, passwordEntry)],
        ["listDialogs", (service) => service.listChats(actor, "telegram-1")],
    ])("propagates %s failures without changing the session or account", async (method, invoke) => {
        const { service, hub, connections, telegram } = await build()
        const cause = new Error("dependency failed")
        hub.credentialOf.mockResolvedValue(
            JSON.stringify({ session: "final-session", login: { ...login, stage: "password" } }),
        )
        telegram[method].mockRejectedValue(cause)
        await expect(invoke(service)).rejects.toBe(cause)
        expect(hub.create).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("propagates setup persistence failures", async () => {
        const { service, hub } = await build()
        const cause = new Error("setup write failed")
        hub.credentialOf.mockResolvedValue(finalCredential)
        hub.update.mockRejectedValue(cause)
        await expect(service.saveSetup(actor, setup)).rejects.toBe(cause)
    })

    it("does not patch the account when persisting the final session fails", async () => {
        const { service, hub, connections } = await build()
        const cause = new Error("credential write failed")
        hub.saveCredential.mockRejectedValue(cause)
        await expect(service.submitCode(actor, { connectionId: "telegram-1", code: "12345" })).rejects.toBe(cause)
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it.each<[string, string | null, ReadonlyArray<ReadonlyArray<string>>]>([
        [
            "both sessions",
            JSON.stringify({ session: "final-session", login }),
            [["final-session"], ["pending-session"]],
        ],
        ["temporary session", JSON.stringify({ login }), [["pending-session"]]],
        ["final session", finalCredential, [["final-session"]]],
        ["no sessions", null, []],
    ])("logs out %s before blanking the credential", async (_, credential, calls) => {
        const { service, hub, telegram } = await build()
        hub.credentialOf.mockResolvedValue(credential)
        await expect(service.forgetSession("workspace-1", "telegram-1")).resolves.toBeUndefined()
        expect(hub.owner).not.toHaveBeenCalled()
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "telegram-1", "telegram_user")
        expect(telegram.logOut.mock.calls).toEqual(calls)
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", "{}")
    })

    it("blanks the credential even when logging out the first session fails", async () => {
        const { service, hub, telegram } = await build()
        const cause = new Error("logout failed")
        hub.credentialOf.mockResolvedValue(JSON.stringify({ session: "final-session", login }))
        telegram.logOut.mockRejectedValue(cause)
        await expect(service.forgetSession("workspace-1", "telegram-1")).rejects.toBe(cause)
        expect(telegram.logOut.mock.calls).toEqual([["final-session"]])
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", "{}")
    })

    it.each<"own" | "credentialOf">(["own", "credentialOf"])("keeps sessions when %s lookup fails", async (lookup) => {
        const { service, hub, telegram } = await build()
        const cause = new DataHubError({ code: DataHubErrorCode.NotFound })
        hub[lookup].mockRejectedValue(cause)
        await expect(service.forgetSession("workspace-1", "telegram-1")).rejects.toBe(cause)
        expect(telegram.logOut).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
    })

    it("propagates credential clearing failures after logging out", async () => {
        const { service, hub, telegram } = await build()
        const cause = new Error("credential clear failed")
        hub.credentialOf.mockResolvedValue(finalCredential)
        hub.saveCredential.mockRejectedValue(cause)
        await expect(service.forgetSession("workspace-1", "telegram-1")).rejects.toBe(cause)
        expect(telegram.logOut).toHaveBeenCalledWith("final-session")
    })
})
