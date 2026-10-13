import { Injectable } from "@nestjs/common"
import { AppCommandsService } from "@modules/domain/app-commands"
import type { AppCommand, AppCommandResult } from "@modules/domain/app-commands"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { InviteSupportService, WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import { DomainError } from "@modules/platform/errors"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { QueueError, QueueErrorCode } from "@modules/platform/queue"
import { inviteCommandPayloadOf } from "@modules/queues/invite-command"

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

@Injectable()
/** The one effect of the job: the invitation the web app asked for is created, sent again, linked or re-issued by the platform team, and the asker finds the answer on the command row. */
export class IssueInviteStep implements JobStep {
    constructor(
        private readonly commands: AppCommandsService,
        private readonly invites: WorkspaceInvitesService,
        private readonly support: InviteSupportService,
        private readonly audits: PlatformAuditService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then serves the command. A
     * refusal of the domain (a bad address, a taken staff row, a missing invitation) settles the command as failed with its code and ends the
     * job; any other failure is thrown so the queue retries the delivery. A command already settled is left as it is.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "issue" })
        const payload = inviteCommandPayloadOf(job.payload)
        if (payload === null) return
        const command = await this.commands.begin(payload.commandId)
        if (command === null) return
        try {
            await this.commands.succeed(command.id, await this.serve(command))
        } catch (cause) {
            if (!(cause instanceof DomainError)) throw cause
            await this.commands.fail(command.id, cause.code)
        }
    }

    /** Settles the command of a job that ran out of attempts, so the asker stops waiting. */
    async abandon(payload: object): Promise<void> {
        const named = inviteCommandPayloadOf(payload)
        if (named !== null) await this.commands.fail(named.commandId, "unavailable")
    }

    private async serve(command: AppCommand): Promise<AppCommandResult> {
        const workspaceId = command.workspaceId ?? ""
        const inviteId = textOf(command.input.inviteId)
        if (command.kind === "invite.create") {
            const staffId = textOf(command.input.staffId)
            const created = await this.invites.create(command.requestedBy, workspaceId, {
                email: textOf(command.input.email),
                role: command.input.role === "manager" ? "manager" : "staff",
                staffId: staffId === "" ? null : staffId,
            })
            return { ...created }
        }
        if (command.kind === "invite.resend") {
            return { ...(await this.invites.resend(command.requestedBy, workspaceId, inviteId)) }
        }
        if (command.kind === "invite.link") {
            return { ...(await this.invites.copyLink(command.requestedBy, workspaceId, inviteId)) }
        }
        if (command.kind === "admin.invite.resend") {
            const issued = await this.support.reissue(workspaceId, inviteId)
            await this.audits.record({
                actorId: command.requestedBy,
                actorEmail: textOf(command.input.actorEmail),
                action: "invite.resend",
                workspaceId,
                data: { inviteId, email: issued.email, delivery: issued.delivery },
            })
            return { ...issued }
        }
        throw new QueueError({ code: QueueErrorCode.Unrecoverable })
    }
}
