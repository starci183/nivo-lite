import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AppCommandsService } from "@modules/domain/app-commands"
import type { AppCommand } from "@modules/domain/app-commands"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { InviteSupportService, WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { InviteResult } from "@modules/domain/workspace-invites"
import { DomainError } from "@modules/platform/errors"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { IssueInviteStep } from "./issue-invite.step"

class DomainRefusal extends DomainError<string> {}

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "invite_command",
    fencingToken: 7,
    currentStep: null,
    payload: { commandId: "command-1" },
}
const command: AppCommand = {
    id: "command-1",
    workspaceId: "workspace-1",
    requestedBy: "user-1",
    kind: "invite.create",
    input: { email: "invitee@example.com", role: "manager", staffId: "staff-1", inviteId: "invite-1" },
}
const issued: InviteResult = {
    email: "invitee@example.com",
    link: "https://nivo.example/invite/token-1",
    delivery: "invited",
}

const build = async (named: AppCommand | null = command) => {
    const commands = mock<AppCommandsService>()
    commands.begin.mockResolvedValue(named)
    commands.succeed.mockResolvedValue(undefined)
    commands.fail.mockResolvedValue(undefined)
    const invites = mock<WorkspaceInvitesService>()
    invites.create.mockResolvedValue(issued)
    invites.resend.mockResolvedValue(issued)
    invites.copyLink.mockResolvedValue({ ...issued, delivery: "none" })
    const support = mock<InviteSupportService>()
    support.reissue.mockResolvedValue(issued)
    const audits = mock<PlatformAuditService>()
    audits.record.mockResolvedValue(undefined)
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            IssueInviteStep,
            { provide: AppCommandsService, useValue: commands },
            { provide: WorkspaceInvitesService, useValue: invites },
            { provide: InviteSupportService, useValue: support },
            { provide: PlatformAuditService, useValue: audits },
        ],
    })
        .useMocker((token) => {
            if (typeof token === "symbol" && token.description === "platform.jobs.claims") return claims
            throw new DomainRefusal({ code: "TEST_UNEXPECTED_DEPENDENCY" })
        })
        .compile()
    return { step: moduleRef.get(IssueInviteStep), commands, invites, support, audits, claims }
}

describe("IssueInviteStep", () => {
    it("creates the manager invitation as the asker and settles the command with its exact answer", async () => {
        const { step, commands, invites, support, audits, claims } = await build()

        await expect(step.run(job)).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "issue" }]])
        expect(commands.begin.mock.calls).toEqual([["command-1"]])
        expect(invites.create.mock.calls).toEqual([
            ["user-1", "workspace-1", { email: "invitee@example.com", role: "manager", staffId: "staff-1" }],
        ])
        expect(commands.succeed.mock.calls).toEqual([["command-1", issued]])
        expect(commands.fail).not.toHaveBeenCalled()
        expect(invites.resend).not.toHaveBeenCalled()
        expect(invites.copyLink).not.toHaveBeenCalled()
        expect(support.reissue).not.toHaveBeenCalled()
        expect(audits.record).not.toHaveBeenCalled()
    })

    it.each([
        { email: 17, role: "owner", staffId: false },
        { email: "", role: "staff", staffId: "" },
    ])("defaults malformed create fields to a staff invitation with no linked staff: %j", async (input) => {
        const { step, commands, invites } = await build({ ...command, workspaceId: null, input })

        await step.run(job)

        expect(invites.create.mock.calls).toEqual([["user-1", "", { email: "", role: "staff", staffId: null }]])
        expect(commands.succeed.mock.calls).toEqual([["command-1", issued]])
    })

    it("resends the named invitation as the asker", async () => {
        const { step, commands, invites, support, audits } = await build({ ...command, kind: "invite.resend" })

        await step.run(job)

        expect(invites.resend.mock.calls).toEqual([["user-1", "workspace-1", "invite-1"]])
        expect(commands.succeed.mock.calls).toEqual([["command-1", issued]])
        expect(invites.create).not.toHaveBeenCalled()
        expect(invites.copyLink).not.toHaveBeenCalled()
        expect(support.reissue).not.toHaveBeenCalled()
        expect(audits.record).not.toHaveBeenCalled()
    })

    it("copies the invitation link and stores the answer without delivery", async () => {
        const { step, commands, invites, support, audits } = await build({ ...command, kind: "invite.link" })

        await step.run(job)

        expect(invites.copyLink.mock.calls).toEqual([["user-1", "workspace-1", "invite-1"]])
        expect(commands.succeed.mock.calls).toEqual([["command-1", { ...issued, delivery: "none" }]])
        expect(invites.create).not.toHaveBeenCalled()
        expect(invites.resend).not.toHaveBeenCalled()
        expect(support.reissue).not.toHaveBeenCalled()
        expect(audits.record).not.toHaveBeenCalled()
    })

    it.each([
        ["admin@example.com", "admin@example.com"],
        [null, ""],
    ])("reissues an invitation for the platform team and audits actor email %s", async (actorEmail, expectedEmail) => {
        const { step, commands, invites, support, audits } = await build({
            ...command,
            kind: "admin.invite.resend",
            input: { inviteId: "invite-1", actorEmail },
        })

        await step.run(job)

        expect(support.reissue.mock.calls).toEqual([["workspace-1", "invite-1"]])
        expect(audits.record.mock.calls).toEqual([
            [
                {
                    actorId: "user-1",
                    actorEmail: expectedEmail,
                    action: "invite.resend",
                    workspaceId: "workspace-1",
                    data: { inviteId: "invite-1", email: "invitee@example.com", delivery: "invited" },
                },
            ],
        ])
        expect(support.reissue.mock.invocationCallOrder[0]).toBeLessThan(audits.record.mock.invocationCallOrder[0] ?? 0)
        expect(audits.record.mock.invocationCallOrder[0]).toBeLessThan(
            commands.succeed.mock.invocationCallOrder[0] ?? 0,
        )
        expect(commands.succeed.mock.calls).toEqual([["command-1", issued]])
        expect(invites.create).not.toHaveBeenCalled()
        expect(invites.resend).not.toHaveBeenCalled()
        expect(invites.copyLink).not.toHaveBeenCalled()
    })

    it("waits for the claim to advance before beginning a command or causing its effect", async () => {
        const { step, commands, invites, claims } = await build()
        const pending = mock<{ release(): void }>()
        claims.advance.mockImplementation(
            () => new Promise<void>((resolve) => pending.release.mockImplementation(resolve)),
        )

        const running = step.run(job)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "issue" }]])
        expect(commands.begin).not.toHaveBeenCalled()
        expect(invites.create).not.toHaveBeenCalled()
        expect(commands.succeed).not.toHaveBeenCalled()
        pending.release()
        await running

        expect(commands.begin.mock.calls).toEqual([["command-1"]])
        expect(invites.create.mock.calls).toEqual([
            ["user-1", "workspace-1", { email: "invitee@example.com", role: "manager", staffId: "staff-1" }],
        ])
        expect(commands.succeed.mock.calls).toEqual([["command-1", issued]])
    })

    it("does no command work when advancing the claim fails", async () => {
        const { step, commands, invites, claims } = await build()
        const cause = new Error("stale fencing token")
        claims.advance.mockRejectedValue(cause)

        await expect(step.run(job)).rejects.toBe(cause)

        expect(commands.begin).not.toHaveBeenCalled()
        expect(invites.create).not.toHaveBeenCalled()
        expect(commands.succeed).not.toHaveBeenCalled()
        expect(commands.fail).not.toHaveBeenCalled()
    })

    it.each([{}, { commandId: 17 }])("advances but ignores a payload with no named command: %j", async (payload) => {
        const { step, commands, invites, support, audits, claims } = await build()

        await expect(step.run({ ...job, payload })).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "issue" }]])
        expect(commands.begin).not.toHaveBeenCalled()
        expect(commands.succeed).not.toHaveBeenCalled()
        expect(commands.fail).not.toHaveBeenCalled()
        expect(invites.create).not.toHaveBeenCalled()
        expect(invites.resend).not.toHaveBeenCalled()
        expect(invites.copyLink).not.toHaveBeenCalled()
        expect(support.reissue).not.toHaveBeenCalled()
        expect(audits.record).not.toHaveBeenCalled()
    })

    it("leaves missing or already settled commands alone when begin returns null", async () => {
        const { step, commands, invites, support, audits } = await build(null)

        await expect(step.run(job)).resolves.toBeUndefined()

        expect(commands.begin.mock.calls).toEqual([["command-1"]])
        expect(commands.succeed).not.toHaveBeenCalled()
        expect(commands.fail).not.toHaveBeenCalled()
        expect(invites.create).not.toHaveBeenCalled()
        expect(invites.resend).not.toHaveBeenCalled()
        expect(invites.copyLink).not.toHaveBeenCalled()
        expect(support.reissue).not.toHaveBeenCalled()
        expect(audits.record).not.toHaveBeenCalled()
    })

    it("settles a domain refusal with the domain's exact code", async () => {
        const { step, commands, invites } = await build()
        invites.create.mockRejectedValue(new DomainRefusal({ code: "WORKSPACE_INVITES_EMAIL_INVALID" }))

        await expect(step.run(job)).resolves.toBeUndefined()

        expect(commands.fail.mock.calls).toEqual([["command-1", "WORKSPACE_INVITES_EMAIL_INVALID"]])
        expect(commands.succeed).not.toHaveBeenCalled()
    })

    it("fails an unsupported command kind with the unrecoverable queue code", async () => {
        const { step, commands, invites, support, audits } = await build({ ...command, kind: "video.render" })

        await expect(step.run(job)).resolves.toBeUndefined()

        expect(commands.fail.mock.calls).toEqual([["command-1", "QUEUE_UNRECOVERABLE"]])
        expect(commands.succeed).not.toHaveBeenCalled()
        expect(invites.create).not.toHaveBeenCalled()
        expect(invites.resend).not.toHaveBeenCalled()
        expect(invites.copyLink).not.toHaveBeenCalled()
        expect(support.reissue).not.toHaveBeenCalled()
        expect(audits.record).not.toHaveBeenCalled()
    })

    it("rethrows a non-domain failure so delivery can retry", async () => {
        const { step, commands, invites } = await build()
        const cause = new Error("mail provider unavailable")
        invites.create.mockRejectedValue(cause)

        await expect(step.run(job)).rejects.toBe(cause)

        expect(commands.succeed).not.toHaveBeenCalled()
        expect(commands.fail).not.toHaveBeenCalled()
    })

    it("rethrows a failure to store success without failing the command", async () => {
        const { step, commands } = await build()
        const cause = new Error("command store unavailable")
        commands.succeed.mockRejectedValue(cause)

        await expect(step.run(job)).rejects.toBe(cause)

        expect(commands.succeed.mock.calls).toEqual([["command-1", issued]])
        expect(commands.fail).not.toHaveBeenCalled()
    })

    describe("abandon", () => {
        it("settles the named command as unavailable after the last delivery attempt", async () => {
            const { step, commands, claims, invites } = await build()

            await expect(step.abandon({ commandId: "command-2" })).resolves.toBeUndefined()

            expect(commands.fail.mock.calls).toEqual([["command-2", "unavailable"]])
            expect(commands.begin).not.toHaveBeenCalled()
            expect(commands.succeed).not.toHaveBeenCalled()
            expect(claims.advance).not.toHaveBeenCalled()
            expect(invites.create).not.toHaveBeenCalled()
        })

        it.each([{}, { commandId: false }])("ignores a payload with no command to abandon: %j", async (payload) => {
            const { step, commands } = await build()

            await expect(step.abandon(payload)).resolves.toBeUndefined()

            expect(commands.fail).not.toHaveBeenCalled()
        })

        it("rethrows a failure to store the abandoned command", async () => {
            const { step, commands } = await build()
            const cause = new Error("command store unavailable")
            commands.fail.mockRejectedValue(cause)

            await expect(step.abandon({ commandId: "command-2" })).rejects.toBe(cause)

            expect(commands.fail.mock.calls).toEqual([["command-2", "unavailable"]])
        })
    })
})
