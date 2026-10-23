import { Injectable } from "@nestjs/common"
import { AppCommandsService } from "@modules/domain/app-commands"
import type { AppCommand, AppCommandResult } from "@modules/domain/app-commands"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { isDomainError } from "@modules/platform/errors"
import { QueueErrorCode } from "@modules/platform/queue"
import { inviteCommandPayloadOf } from "@modules/queues/invite-command"
import { InviteSupportService } from "./invite-support.service"
import { WorkspaceInvitesService } from "./workspace-invites.service"

/** The text a command input field holds, or empty when it holds no text. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

@Injectable()
/**
 * Serves the invitation commands the web app writes to the database: an invitation is created, sent again, linked or re-issued by the
 * platform team, and the asker finds the answer (or the code of the refusal) on the command row.
 */
export class InviteCommandsService {
    constructor(
        private readonly commands: AppCommandsService,
        private readonly invites: WorkspaceInvitesService,
        private readonly support: InviteSupportService,
        private readonly audits: PlatformAuditService,
    ) {}

    /**
     * Serves the command a claimed job names. A refusal of the domain (a bad address, a taken staff row, a missing invitation) settles the
     * command as failed with its code (a kind it does not know as unrecoverable); any other failure is thrown so the queue retries the delivery. A payload that names no command, or
     * a command already settled, is left as it is.
     */
    async run(payload: object): Promise<void> {
        const named = inviteCommandPayloadOf(payload)
        if (named === null) return
        const command = await this.commands.begin(named.commandId)
        if (command === null) return
        try {
            const result = await this.serve(command)
            if (result === null) await this.commands.fail(command.id, QueueErrorCode.Unrecoverable)
            else await this.commands.succeed(command.id, result)
        } catch (cause) {
            if (!isDomainError(cause)) throw cause
            await this.commands.fail(command.id, cause.code)
        }
    }

    /** Settles the command of a job that ran out of attempts, so the asker stops waiting. */
    async abandon(payload: object): Promise<void> {
        const named = inviteCommandPayloadOf(payload)
        if (named !== null) await this.commands.fail(named.commandId, "unavailable")
    }

    /** Does what the command asks, as the person who asked; answers what the web app shows, or null for a kind it does not know. */
    private async serve(command: AppCommand): Promise<AppCommandResult | null> {
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
        return null
    }
}
