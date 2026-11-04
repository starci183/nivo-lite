import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelSeedService } from "@modules/domain/channel-connections"
import type { SeededConnection } from "@modules/domain/channel-connections"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { SmtpWizardService } from "@modules/domain/email-messages"
import { OwnersService } from "@modules/domain/owners"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import { MANAGEMENT_CONNECTION_IDS, MANAGEMENT_SEED_SCHEMA } from "./management-seed.contracts"
import { ManagementSeedService } from "./management-seed.service"

const ACTOR = { principalId: "owner-1", workspaceId: "ws-1" }
const SEEDED: ReadonlyArray<SeededConnection> = [
    { provider: "telegram", id: MANAGEMENT_CONNECTION_IDS.telegram, action: "created", credentials: "saved" },
    { provider: "sepay", id: MANAGEMENT_CONNECTION_IDS.sepay, action: "kept", credentials: "missing" },
]
const SMTP_VALUES = {
    WORKSPACE_OWNER_EMAIL: "owner@nivo.test",
    WORKSPACE_SMTP_HOST: "smtp.nivo.test",
    WORKSPACE_SMTP_PORT: "465",
    WORKSPACE_SMTP_USER: "mailer",
    WORKSPACE_SMTP_PASSWORD: "mail-pass-1",
    WORKSPACE_SMTP_FROM: "no-reply@nivo.test",
}
const envelope = (document: object): string => `${JSON.stringify({ documents: [{ path: "data/a.json", document }] })}\n`
const production = envelope({ schema: MANAGEMENT_SEED_SCHEMA, workspaceName: "NIVO", values: SMTP_VALUES })
const development = envelope({ schema: MANAGEMENT_SEED_SCHEMA, workspaceName: "NIVO", ownerEmail: "dev@nivo.test" })

const heldSmtp = (host: string, from: string): ConnectionRecord => ({
    id: "smtp-1",
    workspaceId: ACTOR.workspaceId,
    provider: "smtp",
    name: "NIVO",
    meta: { host, from_email: from },
    status: "pending",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: ACTOR.principalId,
    createdAt: "2026-11-03T00:00:00.000Z",
})

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const build = async (held: ReadonlyArray<ConnectionRecord> = []) => {
    const owners = mock<OwnersService>()
    owners.ensureAccount.mockResolvedValue(ACTOR.principalId)
    const workspaces = mock<WorkspacesService>()
    workspaces.ensureNamed.mockResolvedValue({ id: ACTOR.workspaceId })
    const channels = mock<ChannelSeedService>()
    channels.ensure.mockResolvedValue(SEEDED)
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue(held)
    const smtp = mock<SmtpWizardService>()
    smtp.start.mockResolvedValue({
        id: "smtp-2",
        host: "smtp.nivo.test",
        fromEmail: "no-reply@nivo.test",
        isDefault: false,
    })
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ManagementSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: OwnersService, useValue: owners },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: ChannelSeedService, useValue: channels },
            { provide: ConnectionsService, useValue: connections },
            { provide: SmtpWizardService, useValue: smtp },
        ],
    }).compile()
    return { service: moduleRef.get(ManagementSeedService), owners, workspaces, channels, connections, smtp, print }
}

describe("ManagementSeedService > a production document", () => {
    it("ensures the owner, the workspace, the connections and the mail server, and prints no value", async () => {
        const { service, owners, workspaces, channels, smtp, print } = await build()

        await service.run(production)

        expect(owners.ensureAccount).toHaveBeenCalledWith("owner@nivo.test")
        expect(workspaces.ensureNamed).toHaveBeenCalledWith("owner-1", "NIVO")
        expect(channels.ensure).toHaveBeenCalledWith(ACTOR, objectLike({ telegram: expect.anything() }))
        expect(smtp.start).toHaveBeenCalledWith(ACTOR, {
            preset: "relay_service",
            host: "smtp.nivo.test",
            port: 465,
            security: "tls",
            user: "mailer",
            password: "mail-pass-1",
            fromName: "NIVO",
            fromEmail: "no-reply@nivo.test",
            replyTo: "",
        })
        expect(print.mock.calls.map(([line]) => line)).toEqual([
            "management workspace ws-1",
            `telegram connection ${MANAGEMENT_CONNECTION_IDS.telegram} created, credentials saved`,
            `sepay connection ${MANAGEMENT_CONNECTION_IDS.sepay} kept, credentials missing`,
            "smtp connection smtp-2 created, pending its test email",
        ])
        expect(print.mock.calls.flat().join("\n")).not.toContain("mail-pass-1")
    })

    it("starts the mail server on the open channel for a port that is not the TLS port", async () => {
        const { service, smtp } = await build()
        const text = envelope({
            schema: MANAGEMENT_SEED_SCHEMA,
            workspaceName: "NIVO",
            values: { ...SMTP_VALUES, WORKSPACE_SMTP_PORT: "587" },
        })

        await service.run(text)

        expect(smtp.start).toHaveBeenCalledWith(ACTOR, expect.objectContaining({ port: 587, security: "starttls" }))
    })

    it("keeps the SMTP connection the workspace already has for that server and sender", async () => {
        const { service, smtp, print } = await build([heldSmtp("smtp.nivo.test", "no-reply@nivo.test")])

        await service.run(production)

        expect(smtp.start).not.toHaveBeenCalled()
        expect(print).toHaveBeenLastCalledWith("smtp connection kept")
    })

    it("adds an SMTP connection when the one it holds is for another sender", async () => {
        const { service, smtp } = await build([heldSmtp("smtp.nivo.test", "other@nivo.test")])

        await service.run(production)

        expect(smtp.start).toHaveBeenCalledTimes(1)
    })
})

describe("ManagementSeedService > a development document", () => {
    it("seeds the workspace of the owner it names with connections that miss their credentials and no mail server", async () => {
        const { service, owners, channels, smtp, connections } = await build()

        await service.run(development)

        expect(owners.ensureAccount).toHaveBeenCalledWith("dev@nivo.test")
        expect(channels.ensure).toHaveBeenCalledTimes(1)
        expect(smtp.start).not.toHaveBeenCalled()
        expect(connections.listByProvider).not.toHaveBeenCalled()
    })
})

describe("ManagementSeedService > an input it refuses", () => {
    it("writes nothing for a document off its contract", async () => {
        const { service, owners, workspaces } = await build()

        await expect(service.run(envelope({ schema: "other@1" }))).rejects.toEqual(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "schema" } }),
        )
        expect(owners.ensureAccount).not.toHaveBeenCalled()
        expect(workspaces.ensureNamed).not.toHaveBeenCalled()
    })
})
