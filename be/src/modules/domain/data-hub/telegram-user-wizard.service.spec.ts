import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import {
    TELEGRAM_NOT_CONFIGURED_MESSAGE,
    TELEGRAM_REVOKED_MESSAGE,
    TELEGRAM_USER,
} from "@modules/integrations/data-sources"
import type { TelegramUserClient } from "@modules/integrations/data-sources"
import { CLOCK } from "@modules/platform/clock"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { TELEGRAM_WIZARD_TEXT as TEXT } from "./messages/telegram-user-wizard.messages"
import type {
    PickedChat,
    SaveTelegramSetupInput,
    TelegramLoginDraft,
    TelegramLoginState,
} from "./telegram-user-wizard.contracts"
import { TelegramUserWizardService } from "./telegram-user-wizard.service"

const NOW = "2026-10-14T12:00:00.000Z"
const actor: ConnectionActor = { workspaceId: "workspace-1", principalId: "owner-1" }
const connection = builder<DataConnection>({
    id: "telegram-1",
    workspaceId: actor.workspaceId,
    provider: "telegram_user",
    name: "Personal Telegram",
    status: "pending",
    lastError: null,
    meta: { consentAt: "2026-10-14T11:00:00.000Z", retained: "fact" },
    everyMinutes: null,
    lastSyncAt: null,
})
const login = builder<TelegramLoginState>({
    stage: "code",
    phone: "+84912345678",
    phoneCodeHash: "code-hash",
    session: "login-session",
    startedAt: Date.parse(NOW),
})
const draft: TelegramLoginDraft = { name: " Personal Telegram ", phone: "0912 345 678", consent: true }
const pickedChat: PickedChat = { id: "42", title: "Ada", kind: "user" }
const setup: SaveTelegramSetupInput = {
    connectionId: "telegram-1",
    chats: [pickedChat],
    sinceDays: 30,
    everyMinutes: 15,
}
const build = async () => {
    const hub = mock<DataHubService>()
    const connections = mock<ConnectionsService>()
    const telegram = mock<TelegramUserClient>()
    hub.own.mockResolvedValue(connection())
    hub.credentialOf.mockResolvedValue(JSON.stringify({ login: login() }))
    hub.create.mockResolvedValue("telegram-new")
    telegram.configured.mockReturnValue(true)
    telegram.sendCode.mockResolvedValue({ phoneCodeHash: "sent-hash", session: "sent-session", viaApp: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramUserWizardService,
            { provide: DataHubService, useValue: hub },
            { provide: ConnectionsService, useValue: connections },
            { provide: TELEGRAM_USER, useValue: telegram },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramUserWizardService), hub, connections, telegram }
}

describe("TelegramUserWizardService", () => {
    it.each([true, false])("checks owner access before reporting readiness %s", async (configured) => {
        const { service, hub, telegram } = await build()
        telegram.configured.mockReturnValue(configured)
        await expect(service.ready(actor)).resolves.toBe(configured)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.configured).toHaveBeenCalledTimes(1)
    })

    it("loads an unexpired pending password step with saved choices and consent", async () => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: login({ stage: "password" }) }))
        const config = { chats: setup.chats, sinceDays: 30 }
        hub.own.mockResolvedValue(
            connection({ meta: { config: JSON.stringify(config), consentAt: NOW }, everyMinutes: 60 }),
        )
        await expect(service.load(actor, "telegram-1")).resolves.toEqual({
            name: "Personal Telegram",
            status: "pending",
            stage: "password",
            config,
            everyMinutes: 60,
            consent: true,
        })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", "telegram_user")
        expect(hub.credentialOf).toHaveBeenCalledWith("telegram-1")
    })

    it.each(["connected", "error", "disconnected"] as const)("loads %s accounts at the ready step", async (status) => {
        const { service, hub } = await build()
        hub.own.mockResolvedValue(connection({ status, meta: {} }))
        hub.credentialOf.mockResolvedValue("{}")
        await expect(service.load(actor, "telegram-1")).resolves.toEqual({
            name: "Personal Telegram",
            status: status === "error" ? "error" : "connected",
            stage: "ready",
            config: null,
            everyMinutes: null,
            consent: false,
        })
    })

    it.each(["{}", JSON.stringify({ login: login({ startedAt: Date.parse(NOW) - 600001 }) })])(
        "rejects missing or expired login state on load: %s",
        async (credential) => {
            const { service, hub } = await build()
            hub.credentialOf.mockResolvedValue(credential)
            await expect(service.load(actor, "telegram-1")).rejects.toMatchObject({
                code: DataHubErrorCode.Invalid,
                params: { detail: TEXT.expired },
            })
        },
    )

    it.each([
        { input: draft, configured: false, detail: TELEGRAM_NOT_CONFIGURED_MESSAGE },
        { input: { ...draft, consent: false }, configured: true, detail: TEXT.consent },
        { input: { ...draft, name: " " }, configured: true, detail: TEXT.nameRequired },
        { input: { ...draft, phone: "invalid" }, configured: true, detail: TEXT.phoneInvalid },
    ])("validates login before requesting a code: $detail", async ({ input, configured, detail }) => {
        const { service, hub, telegram } = await build()
        telegram.configured.mockReturnValue(configured)
        await expect(service.startLogin(actor, input)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(telegram.sendCode).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
    })

    it.each([undefined, null])("creates a consented pending login for connection id %s", async (connectionId) => {
        const { service, hub, telegram } = await build()
        await expect(service.startLogin(actor, { ...draft, connectionId })).resolves.toEqual({
            connectionId: "telegram-new",
            viaApp: true,
        })
        expect(telegram.sendCode).toHaveBeenCalledWith("+84912345678")
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "telegram_user",
            name: "Personal Telegram",
            meta: { consentAt: NOW },
            credential: JSON.stringify({ login: login({ phoneCodeHash: "sent-hash", session: "sent-session" }) }),
            everyMinutes: null,
            status: "pending",
        })
    })

    it("reuses a pending connection and clips its name while retaining public facts", async () => {
        const { service, hub, connections, telegram } = await build()
        telegram.sendCode.mockResolvedValue({ phoneCodeHash: "retry-hash", session: "retry-session", viaApp: false })
        await expect(
            service.startLogin(actor, { ...draft, name: ` ${"x".repeat(90)} `, connectionId: "telegram-1" }),
        ).resolves.toEqual({ connectionId: "telegram-1", viaApp: false })
        expect(hub.own).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", "telegram_user")
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "telegram-1",
            JSON.stringify({ login: login({ phoneCodeHash: "retry-hash", session: "retry-session" }) }),
        )
        expect(connections.patch).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", {
            name: "x".repeat(80),
            meta: { ...connection().meta, consentAt: NOW },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("rejects a new code request on an account already logged in", async () => {
        const { service, hub, telegram } = await build()
        hub.own.mockResolvedValue(connection({ status: "connected" }))
        await expect(service.startLogin(actor, { ...draft, connectionId: "telegram-1" })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: TEXT.alreadyLoggedIn },
        })
        expect(telegram.sendCode).not.toHaveBeenCalled()
    })

    it.each([
        { status: "connected" as const, credential: JSON.stringify({ login: login() }), detail: TEXT.noPendingLogin },
        { status: "pending" as const, credential: "{}", detail: TEXT.noPendingLogin },
        {
            status: "pending" as const,
            credential: JSON.stringify({ login: login({ startedAt: Date.parse(NOW) - 600001 }) }),
            detail: TEXT.expired,
        },
    ])("rejects unusable pending state on resend: $detail", async ({ status, credential, detail }) => {
        const { service, hub, telegram } = await build()
        hub.own.mockResolvedValue(connection({ status }))
        hub.credentialOf.mockResolvedValue(credential)
        await expect(service.resendCode(actor, "telegram-1")).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(telegram.resendCode).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
    })

    it("resends a code from the password stage without extending the login lifetime", async () => {
        const { service, hub, telegram } = await build()
        const state = login({ stage: "password", startedAt: Date.parse(NOW) - 500000 })
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: state }))
        telegram.resendCode.mockResolvedValue({ session: "resent-session", phoneCodeHash: "resent-hash" })
        await expect(service.resendCode(actor, "telegram-1")).resolves.toBeUndefined()
        expect(telegram.resendCode).toHaveBeenCalledWith(state)
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "telegram-1",
            JSON.stringify({
                login: { ...state, stage: "code", session: "resent-session", phoneCodeHash: "resent-hash" },
            }),
        )
    })

    it.each(["123", "123456789"])("rejects code length %s before signing in", async (code) => {
        const { service, hub, telegram } = await build()
        await expect(service.submitCode(actor, { connectionId: "telegram-1", code })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: TEXT.codeLength },
        })
        expect(telegram.signIn).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
    })

    it("strips code separators and stores the temporary password-stage session", async () => {
        const { service, hub, connections, telegram } = await build()
        telegram.signIn.mockResolvedValue({ kind: "password", session: "two-step-session" })
        await expect(service.submitCode(actor, { connectionId: "telegram-1", code: "12-34 5" })).resolves.toEqual({
            stage: "password",
        })
        expect(telegram.signIn).toHaveBeenCalledWith({ ...login(), code: "12345" })
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "telegram-1",
            JSON.stringify({ login: login({ stage: "password", session: "two-step-session" }) }),
        )
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("finishes code-only login with a final session and a public account label", async () => {
        const { service, hub, connections, telegram } = await build()
        telegram.signIn.mockResolvedValue({
            kind: "ready",
            session: "final-session",
            account: { displayName: " Ada ", username: "ada" },
        })
        await expect(service.submitCode(actor, { connectionId: "telegram-1", code: "12345" })).resolves.toEqual({
            stage: "ready",
        })
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", '{"session":"final-session"}')
        expect(connections.patch).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", {
            meta: { ...connection().meta, account: "Ada (@ada) \u2026678" },
        })
    })

    it.each([
        { state: login(), password: "secret", detail: TEXT.passwordNotNeeded },
        { state: login({ stage: "password" }), password: "", detail: TEXT.passwordRequired },
    ])("rejects a password that cannot be submitted: $detail", async ({ state, password, detail }) => {
        const { service, hub, telegram } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: state }))
        await expect(service.submitPassword(actor, { connectionId: "telegram-1", password })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(telegram.checkPassword).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
    })

    it("uses the two-step password once and replaces the login state with the final session", async () => {
        const { service, hub, connections, telegram } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ login: login({ stage: "password" }) }))
        telegram.checkPassword.mockResolvedValue({
            session: "final-session",
            account: { displayName: "", username: null },
        })
        await expect(
            service.submitPassword(actor, { connectionId: "telegram-1", password: " secret " }),
        ).resolves.toEqual({ stage: "ready" })
        expect(telegram.checkPassword).toHaveBeenCalledWith({ session: "login-session", password: " secret " })
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", '{"session":"final-session"}')
        expect(connections.patch).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", {
            meta: { ...connection().meta, account: "Telegram \u2026678" },
        })
    })

    it.each(["pending", "connected"] as const)("cancels only pending accounts: %s", async (status) => {
        const { service, hub } = await build()
        hub.own.mockResolvedValue(connection({ status }))
        await expect(service.cancelLogin(actor, "telegram-1")).resolves.toBeUndefined()
        expect(hub.owner).toHaveBeenCalledWith(actor)
        if (status === "pending") expect(hub.remove).toHaveBeenCalledWith(actor.workspaceId, "telegram-1")
        else expect(hub.remove).not.toHaveBeenCalled()
    })

    it("lists at most 100 recent chats using the stored session", async () => {
        const { service, hub, telegram } = await build()
        hub.credentialOf.mockResolvedValue('{"session":"saved-session"}')
        const chats = [{ ...pickedChat, unread: 2 }]
        telegram.listDialogs.mockResolvedValue(chats)
        await expect(service.listChats(actor, "telegram-1")).resolves.toEqual(chats)
        expect(telegram.listDialogs).toHaveBeenCalledWith("saved-session", 100)
        expect(hub.owner).toHaveBeenCalledWith(actor)
    })

    it("rejects chat listing when the session was revoked", async () => {
        const { service, telegram } = await build()
        await expect(service.listChats(actor, "telegram-1")).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: TELEGRAM_REVOKED_MESSAGE },
        })
        expect(telegram.listDialogs).not.toHaveBeenCalled()
    })

    it.each([
        { input: setup, credential: "{}", detail: TEXT.notLoggedIn },
        {
            input: { ...setup, everyMinutes: 30 },
            credential: '{"session":"saved-session"}',
            detail: TEXT.scheduleInvalid,
        },
        {
            input: { ...setup, chats: Array.from({ length: 51 }, () => pickedChat) },
            credential: '{"session":"saved-session"}',
            detail: TEXT.tooManyChats(50),
        },
        {
            input: { ...setup, chats: [{ id: "invalid", title: "Invalid", kind: "user" as const }] },
            credential: '{"session":"saved-session"}',
            detail: TEXT.pickOne,
        },
    ])("rejects invalid setup before saving: $detail", async ({ input, credential, detail }) => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(credential)
        await expect(service.saveSetup(actor, input)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(hub.update).not.toHaveBeenCalled()
    })

    it.each([15, null, undefined])(
        "saves cleaned picks and schedule %s while preserving public facts",
        async (everyMinutes) => {
            const { service, hub } = await build()
            hub.credentialOf.mockResolvedValue('{"session":"saved-session"}')
            await expect(
                service.saveSetup(actor, { ...setup, chats: [...setup.chats, ...setup.chats], everyMinutes }),
            ).resolves.toBeUndefined()
            expect(hub.owner).toHaveBeenCalledWith(actor)
            expect(hub.update).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", {
                name: "Personal Telegram",
                meta: {
                    ...connection().meta,
                    config: JSON.stringify({ chats: setup.chats, sinceDays: 30 }),
                    summary: TEXT.summary(1),
                },
                everyMinutes: everyMinutes ?? null,
            })
        },
    )

    it("forgets a credential even when no session remains", async () => {
        const { service, hub, telegram } = await build()
        hub.credentialOf.mockResolvedValue("{}")
        await expect(service.forgetSession(actor.workspaceId, "telegram-1")).resolves.toBeUndefined()
        expect(telegram.logOut).not.toHaveBeenCalled()
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", "{}")
    })

    it("logs out both final and temporary sessions in order and blanks the credential", async () => {
        const { service, hub, telegram } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ session: "saved-session", login: login() }))
        await expect(service.forgetSession(actor.workspaceId, "telegram-1")).resolves.toBeUndefined()
        expect(hub.own).toHaveBeenCalledWith(actor.workspaceId, "telegram-1", "telegram_user")
        expect(telegram.logOut).toHaveBeenCalledTimes(2)
        expect(telegram.logOut).toHaveBeenNthCalledWith(1, "saved-session")
        expect(telegram.logOut).toHaveBeenNthCalledWith(2, "login-session")
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", "{}")
    })

    it("blanks the credential even if ending a session rejects", async () => {
        const { service, hub, telegram } = await build()
        const failure = new Error("Session could not be ended")
        telegram.logOut.mockRejectedValue(failure)
        await expect(service.forgetSession(actor.workspaceId, "telegram-1")).rejects.toBe(failure)
        expect(telegram.logOut).toHaveBeenCalledWith("login-session")
        expect(hub.saveCredential).toHaveBeenCalledWith("telegram-1", "{}")
    })
})
