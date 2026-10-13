import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceInvitesError, WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import type { ChangedInviteRow, MintedTokenRow } from "./persistence/workspace-invites.rows"
import { MINT_TOKEN, ROTATE_INVITE } from "./persistence/workspace-invites.sql"
import type { InviteDeliveryPort, InviteResult } from "./workspace-invites.contracts"
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
        const [minted] = await this.entityManager.query<[MintedTokenRow]>(MINT_TOKEN)
        const expiresAt = new Date(this.clock.now().getTime() + this.options.inviteDays * DAY_MS)
        const [invite] = await this.entityManager.query<Array<ChangedInviteRow>>(ROTATE_INVITE, [
            inviteId,
            workspaceId,
            minted.token,
            expiresAt,
        ])
        if (invite === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        const redirectTo = `${this.options.siteUrl}/auth/confirm?next=${encodeURIComponent(`/invite/${minted.token}`)}`
        const delivery = await this.delivery.deliverInvite(invite.email, redirectTo)
        return { email: invite.email, link: `${this.options.siteUrl}/invite/${minted.token}`, delivery }
    }
}
