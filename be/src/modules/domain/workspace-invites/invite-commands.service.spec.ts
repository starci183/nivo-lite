import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AppCommandsService } from "@modules/domain/app-commands"
import type { AppCommand } from "@modules/domain/app-commands"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { QueueErrorCode } from "@modules/platform/queue"
import { WorkspaceInvitesError, WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { InviteCommandsService } from "./invite-commands.service"
import { InviteSupportService } from "./invite-support.service"
import type { InviteResult } from "./workspace-invites.contracts"
import { WorkspaceInvitesService } from "./workspace-invites.service"

const RESULT: InviteResult = { email: "ha@nivo.vn", link: "https://nivo.vn/invite/tok", delivery: "invited" }

const command = (overrides: Partial<AppCommand> = {}): AppCommand => ({
    id: "command-1",
    workspaceId: "ws-1",
    requestedBy: "user-1",
    kind: "invite.create",
    input: {},
    ...overrides,
})

const build = async (begun: AppCommand | null = command()) => {
    const commands = mock<AppCommandsService>()
    commands.begin.mockResolvedValue(begun)
    const invites = mock<WorkspaceInvitesService>()
    invites.create.mockResolvedValue(RESULT)
    invites.resend.mockResolvedValue(RESULT)
    invites.copyLink.mockResolvedValue(RESULT)
    const support = mock<InviteSupportService>()
    support.reissue.mockResolvedValue(RESULT)
    const audits = mock<PlatformAuditService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InviteCommandsService,
            { provide: AppCommandsService, useValue: commands },
            { provide: WorkspaceInvitesService, useValue: invites },
            { provide: InviteSupportService, useValue: support },
            { provide: PlatformAuditService, useValue: audits },
        ],
    }).compile()
    return { service: moduleRef.get(InviteCommandsService), commands, invites, support, audits }
}

describe("InviteCommandsService", () => {
    it("leaves a payload that names no command alone", async () => {
        const { service, commands } = await build()

        await expect(service.run({ other: "x" })).resolves.toBeUndefined()

        expect(commands.begin).not.toHaveBeenCalled()
    })

    it("leaves a command that is already settled alone", async () => {
        const { service, commands, invites } = await build(null)

        await service.run({ commandId: "command-1" })

        expect(commands.begin).toHaveBeenCalledWith("command-1")
        expect(invites.create).not.toHaveBeenCalled()
        expect(commands.succeed).not.toHaveBeenCalled()
    })

    it("creates a manager invitation linked to a staff row and answers it on the command", async () => {
        const input = { email: "ha@nivo.vn", role: "manager", staffId: "staff-1" }
        const { service, commands, invites } = await build(command({ input }))

        await service.run({ commandId: "command-1" })

        expect(invites.create).toHaveBeenCalledWith("user-1", "ws-1", {
            email: "ha@nivo.vn",
            role: "manager",
            staffId: "staff-1",
        })
        expect(commands.succeed).toHaveBeenCalledWith("command-1", RESULT)
    })

    it("creates a staff invitation with no staff row when the input holds no text", async () => {
        const { service, invites } = await build(command({ workspaceId: null, input: { role: "owner", email: 7 } }))

        await service.run({ commandId: "command-1" })

        expect(invites.create).toHaveBeenCalledWith("user-1", "", { email: "", role: "staff", staffId: null })
    })

    it.each([
        { kind: "invite.resend", method: "resend" as const },
        { kind: "invite.link", method: "copyLink" as const },
    ])("serves $kind through the invitations", async ({ kind, method }) => {
        const { service, commands, invites } = await build(command({ kind, input: { inviteId: "i-1" } }))

        await service.run({ commandId: "command-1" })

        expect(invites[method]).toHaveBeenCalledWith("user-1", "ws-1", "i-1")
        expect(commands.succeed).toHaveBeenCalledWith("command-1", RESULT)
    })
})

describe("InviteCommandsService", () => {
    it("re-issues an invitation for the platform team and audits it", async () => {
        const input = { inviteId: "i-1", actorEmail: "admin@nivo.vn" }
        const { service, commands, support, audits } = await build(command({ kind: "admin.invite.resend", input }))

        await service.run({ commandId: "command-1" })

        expect(support.reissue).toHaveBeenCalledWith("ws-1", "i-1")
        expect(audits.record).toHaveBeenCalledWith({
            actorId: "user-1",
            actorEmail: "admin@nivo.vn",
            action: "invite.resend",
            workspaceId: "ws-1",
            data: { inviteId: "i-1", email: "ha@nivo.vn", delivery: "invited" },
        })
        expect(commands.succeed).toHaveBeenCalledWith("command-1", RESULT)
    })

    it("settles an unknown kind as failed with the unrecoverable code", async () => {
        const { service, commands } = await build(command({ kind: "invite.unknown" }))

        await service.run({ commandId: "command-1" })

        expect(commands.fail).toHaveBeenCalledWith("command-1", QueueErrorCode.Unrecoverable)
        expect(commands.succeed).not.toHaveBeenCalled()
    })

    it("settles a refusal of the domain as failed with its code", async () => {
        const { service, commands, invites } = await build(command({ kind: "invite.resend" }))
        invites.resend.mockRejectedValue(new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound }))

        await service.run({ commandId: "command-1" })

        expect(commands.fail).toHaveBeenCalledWith("command-1", WorkspaceInvitesErrorCode.NotFound)
    })

    it("throws any other failure so the queue retries the delivery", async () => {
        const failure = new Error("database down")
        const { service, commands, invites } = await build(command({ kind: "invite.link" }))
        invites.copyLink.mockRejectedValue(failure)

        await expect(service.run({ commandId: "command-1" })).rejects.toBe(failure)

        expect(commands.fail).not.toHaveBeenCalled()
    })

    it("settles the command of an abandoned job as unavailable", async () => {
        const { service, commands } = await build()

        await service.abandon({ commandId: "command-1" })

        expect(commands.fail).toHaveBeenCalledWith("command-1", "unavailable")
    })

    it("leaves an abandoned payload that names no command alone", async () => {
        const { service, commands } = await build()

        await service.abandon({})

        expect(commands.fail).not.toHaveBeenCalled()
    })
})
