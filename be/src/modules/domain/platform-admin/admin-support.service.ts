import { Injectable } from "@nestjs/common"
import { AiQuotaOverridesService } from "@modules/domain/ai-quota-overrides"
import type { CreditsLimit } from "@modules/domain/ai-quota-overrides"
import { InviteSupportService } from "@modules/domain/workspace-invites"
import { WorkspaceBillingService } from "@modules/domain/workspaces"
import type { SupportStatus } from "@modules/domain/workspaces"
import type { Principal } from "@modules/platform/cqrs"
import { AdminAccessService } from "./admin-access.service"
import type { ExtendedSubscription, InviteResent, PlanSet, StatusSet } from "./platform-admin.contracts"

@Injectable()
/** The console's support actions: each changes one thing through the capability that owns it and audits what changed. */
export class AdminSupportService {
    constructor(
        private readonly access: AdminAccessService,
        private readonly billing: WorkspaceBillingService,
        private readonly quotas: AiQuotaOverridesService,
        private readonly invites: InviteSupportService,
    ) {}

    /** Manual extension: paid_until plus `days`, counted from today when the subscription already lapsed. */
    async extendSubscription(principal: Principal, workspaceId: string, days: number): Promise<ExtendedSubscription> {
        const admin = this.access.requireAdmin(principal)
        const change = await this.billing.extend(workspaceId, days)
        await this.access.audit(admin, "workspace.extend", workspaceId, { days, ...change })
        return { paidUntil: change.to }
    }

    /** Marks the workspace active or past due (billing status only). */
    async setStatus(principal: Principal, workspaceId: string, status: SupportStatus): Promise<StatusSet> {
        const admin = this.access.requireAdmin(principal)
        const change = await this.billing.setStatus(workspaceId, status)
        await this.access.audit(admin, "workspace.set_status", workspaceId, { ...change })
        return { status }
    }

    /**
     * Moves a workspace to another plan (Enterprise is assigned here, by contract) and gives it its own monthly credit allowance;
     * null clears the allowance so the plan's applies. Paid-until is untouched: extending handles the period.
     */
    async setPlan(
        principal: Principal,
        workspaceId: string,
        planCode: string,
        creditsLimit: CreditsLimit,
    ): Promise<PlanSet> {
        const admin = this.access.requireAdmin(principal)
        const change = await this.billing.setPlan(workspaceId, planCode)
        await this.quotas.setCreditsLimit(workspaceId, creditsLimit)
        await this.access.audit(admin, "workspace.set_plan", workspaceId, { ...change, creditsTo: creditsLimit })
        return { planCode: change.to, creditsLimit }
    }

    /** Reissues a pending invitation (the old link stops working) and sends the email again. */
    async resendInvite(principal: Principal, workspaceId: string, inviteId: string): Promise<InviteResent> {
        const admin = this.access.requireAdmin(principal)
        const issued = await this.invites.reissue(workspaceId, inviteId)
        await this.access.audit(admin, "invite.resend", workspaceId, {
            inviteId,
            email: issued.email,
            delivery: issued.delivery,
        })
        return { email: issued.email, delivery: issued.delivery }
    }
}
