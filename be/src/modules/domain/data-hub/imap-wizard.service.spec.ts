import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionActor } from "@modules/domain/connections"
import { IMAP } from "@modules/integrations/data-sources"
import type { ImapClient } from "@modules/integrations/data-sources"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import type { ImapInput } from "./imap-connection.contracts"
import { ImapWizardService } from "./imap-wizard.service"
import { IMAP_CONNECTION_TEXT, imapSummary } from "./messages/imap-connection.messages"

describe("ImapWizardService", () => {
    const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
    const input: ImapInput = {
        name: " Support mailbox ",
        email: " support@example.com ",
        host: " imap.example.com ",
        port: 993,
        security: "tls",
        user: " support@example.com ",
        password: "typed-password",
        folders: ["INBOX", "Sent", "INBOX"],
        sinceDays: 7,
        syncEveryMinutes: 60,
    }
    const connection: DataConnection = {
        id: "imap-1",
        workspaceId: "workspace-1",
        provider: "imap",
        name: "Saved mailbox",
        status: "connected",
        lastError: null,
        meta: { config: '{"folders":["Archive"],"sinceDays":90}', email: "saved@example.com", "cursor:Archive": "42" },
        everyMinutes: 15,
        lastSyncAt: null,
    }
    const savedCredential =
        '{"host":"saved.example.com","port":143,"secure":false,"user":"saved-user","password":"stored-password"}'
    const build = async () => {
        const hub = mock<DataHubService>()
        const imap = mock<ImapClient>()
        hub.own.mockResolvedValue(connection)
        hub.credentialOf.mockResolvedValue(savedCredential)
        hub.create.mockResolvedValue("imap-new")
        const moduleRef = await Test.createTestingModule({
            providers: [
                ImapWizardService,
                { provide: DataHubService, useValue: hub },
                { provide: IMAP, useValue: imap },
            ],
        }).compile()
        return { service: moduleRef.get(ImapWizardService), hub, imap }
    }

    it("tests a new mailbox with cleaned login settings and returns its folders", async () => {
        const { service, hub, imap } = await build()
        imap.listFolders.mockResolvedValue(["INBOX", "Sent"])

        await expect(service.test(actor, input)).resolves.toEqual(["INBOX", "Sent"])
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(imap.listFolders).toHaveBeenCalledWith({
            host: "imap.example.com",
            port: 993,
            secure: true,
            user: "support@example.com",
            password: "typed-password",
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("tests an owned mailbox with its saved password when the typed password is blank", async () => {
        const { service, hub, imap } = await build()
        imap.listFolders.mockResolvedValue(["Archive"])

        await expect(
            service.test(actor, { ...input, connectionId: "imap-1", password: "", security: "starttls", port: 143 }),
        ).resolves.toEqual(["Archive"])
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "imap-1", "imap")
        expect(hub.credentialOf).toHaveBeenCalledWith("imap-1")
        expect(imap.listFolders).toHaveBeenCalledWith({
            host: "imap.example.com",
            port: 143,
            secure: false,
            user: "support@example.com",
            password: "stored-password",
        })
    })

    it("refuses a blank password when an existing mailbox has no saved credential", async () => {
        const { service, hub, imap } = await build()
        hub.credentialOf.mockResolvedValue(null)

        await expect(service.test(actor, { ...input, connectionId: "imap-1", password: "" })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: IMAP_CONNECTION_TEXT.passwordMissing },
        })
        expect(imap.listFolders).not.toHaveBeenCalled()
    })

    it("stops before reading or contacting the mailbox when ownership is denied", async () => {
        const { service, hub, imap } = await build()
        const refusal = new DataHubError({ code: DataHubErrorCode.NotFound })
        hub.owner.mockRejectedValue(refusal)

        await expect(service.test(actor, input)).rejects.toBe(refusal)
        expect(hub.own).not.toHaveBeenCalled()
        expect(imap.listFolders).not.toHaveBeenCalled()
    })

    it("creates a mailbox with cleaned settings and a sealed credential payload", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...input, connectionId: null })).resolves.toBe("imap-new")
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "imap",
            name: "Support mailbox",
            meta: {
                config: '{"folders":["INBOX","Sent"],"sinceDays":7}',
                summary: imapSummary("INBOX, Sent", 7),
                email: "support@example.com",
            },
            credential:
                '{"host":"imap.example.com","port":993,"secure":true,"user":"support@example.com","password":"typed-password"}',
            everyMinutes: 60,
        })
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(hub.update).not.toHaveBeenCalled()
    })

    it("updates an owned mailbox while retaining its cursor and saved password", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...input, connectionId: "imap-1", password: "" })).resolves.toBe("imap-1")
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "imap-1",
            '{"host":"imap.example.com","port":993,"secure":true,"user":"support@example.com","password":"stored-password"}',
        )
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "imap-1", {
            name: "Support mailbox",
            meta: {
                config: '{"folders":["INBOX","Sent"],"sinceDays":7}',
                email: "support@example.com",
                "cursor:Archive": "42",
                summary: imapSummary("INBOX, Sent", 7),
            },
            everyMinutes: 60,
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("loads the saved public settings and unique agent grants without the password", async () => {
        const { service, hub } = await build()
        hub.agentIds.mockResolvedValue(["agent-1", "agent-2", "agent-1"])

        await expect(service.load(actor, "imap-1")).resolves.toEqual({
            id: "imap-1",
            name: "Saved mailbox",
            email: "saved@example.com",
            host: "saved.example.com",
            port: 143,
            security: "starttls",
            user: "saved-user",
            folders: ["Archive"],
            sinceDays: 90,
            syncEveryMinutes: 15,
            agentIds: ["agent-1", "agent-2"],
        })
        expect(hub.agentIds).toHaveBeenCalledWith("workspace-1", "imap-1")
    })

    it("loads default login values when no credential is stored", async () => {
        const { service, hub } = await build()
        hub.own.mockResolvedValue({ ...connection, meta: { config: "broken" } })
        hub.credentialOf.mockResolvedValue(null)
        hub.agentIds.mockResolvedValue([])

        await expect(service.load(actor, "imap-1")).resolves.toEqual({
            id: "imap-1",
            name: "Saved mailbox",
            email: "",
            host: "",
            port: 993,
            security: "tls",
            user: "",
            folders: ["INBOX"],
            sinceDays: 30,
            syncEveryMinutes: 15,
            agentIds: [],
        })
    })

    it("loads implicit TLS when a saved credential enables it", async () => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(
            '{"host":"imap.example.com","port":993,"secure":true,"user":"mail-user","password":"hidden"}',
        )
        hub.agentIds.mockResolvedValue([])

        await expect(service.load(actor, "imap-1")).resolves.toEqual({
            id: "imap-1",
            name: "Saved mailbox",
            email: "saved@example.com",
            host: "imap.example.com",
            port: 993,
            security: "tls",
            user: "mail-user",
            folders: ["Archive"],
            sinceDays: 90,
            syncEveryMinutes: 15,
            agentIds: [],
        })
    })
})
