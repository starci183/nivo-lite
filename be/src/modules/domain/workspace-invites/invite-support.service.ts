import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { WorkspaceInvitesError, WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { hashInviteToken } from "./invite-token.policy"
import { WorkspaceInviteEntity } from "./persistence/entities"
import type { ChangedInvite, InviteDeliveryPort, InviteResult, MintedToken } from "./workspace-invites.contracts"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"
import { InjectInviteDelivery, InjectWorkspaceInvitesOptions } from "./workspace-invites.port"

const DAY_MS = 86_400_000

@Injectable()
/** The invitation reissue the platform team uses from its console: no membership check, the caller proves it is the platform team. */
export class InviteSupportService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectWorkspaceInvitesOptions() private readonly options: WorkspaceInvitesOptions,
        @InjectInviteDelivery() private readonly delivery: InviteDeliveryPort,
    ) {}

    /** Gives a pending invitation of any workspace a new link (the old one stops working) and emails it again. */
    async reissue(workspaceId: string, inviteId: string): Promise<InviteResult> {
        const minted = await this.mintToken()
        const expiresAt = new Date(this.clock.now().getTime() + this.options.inviteDays * DAY_MS)
        const result = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .update()
            .set({ tokenHash: hashInviteToken(minted.token), expiresAt })
            .where("id = :inviteId AND workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL", {
                inviteId,
                workspaceId,
            })
            .returning("id, email, role")
            .execute()
        const [invite] = result.raw as Array<ChangedInvite>
        if (invite === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        const redirectTo = `${this.options.siteUrl}/auth/confirm?next=${encodeURIComponent("/invite/" + minted.token)}`
        const delivery = await this.delivery.deliverInvite(invite.email, redirectTo)
        return { email: invite.email, link: `${this.options.siteUrl}/invite/${minted.token}`, delivery }
    }

    /** Mints an invitation token from two random uuids of the database (its strong random source), dashes removed; only its hash is ever stored. */
    private async mintToken(): Promise<MintedToken> {
        const [first, second] = await Promise.all([this.uuid(), this.uuid()])
        return { token: `${first}${second}`.replaceAll("-", "") }
    }

    private async uuid(): Promise<string> {
        const [row] = await callDbFunction<{ gen_random_uuid: string }>(this.entityManager, "gen_random_uuid", [])
        if (row === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.TokenUnavailable })
        return row.gen_random_uuid
    }
}
