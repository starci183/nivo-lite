import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AiQuotaOverridesService } from "@modules/domain/ai-quota-overrides"
import { InviteSupportService } from "@modules/domain/workspace-invites"
import { WorkspaceBillingService } from "@modules/domain/workspaces"
import type { Principal } from "@modules/platform/cqrs"
import { AdminAccessService } from "./admin-access.service"
import { AdminSupportService } from "./admin-support.service"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"

const ADMIN = { userId: "u-1", email: "team@nivo.vn" }
const PRINCIPAL: Principal = { id: "u-1", email: "team@nivo.vn", role: "authenticated" }

const build = async () => {
    const access = mock<AdminAccessService>()
    access.requireAdmin.mockReturnValue(ADMIN)
    access.audit.mockResolvedValue(undefined)
    const billing = mock<WorkspaceBillingService>()
    const quotas = mock<AiQuotaOverridesService>()
    const invites = mock<InviteSupportService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AdminSupportService,
            { provide: AdminAccessService, useValue: access },
            { provide: WorkspaceBillingService, useValue: billing },
            { provide: AiQuotaOverridesService, useValue: quotas },
            { provide: InviteSupportService, useValue: invites },
        ],
    }).compile()
    return { support: moduleRef.get(AdminSupportService), access, billing, quotas, invites }
}

describe("AdminSupportService", () => {
    it("extends the subscription and audits from and to", async () => {
        const { support, access, billing } = await build()
        billing.extend.mockResolvedValue({ from: "2026-12-01T00:00:00.000Z", to: "2026-12-11T00:00:00.000Z" })

        await expect(support.extendSubscription(PRINCIPAL, "ws-1", 10)).resolves.toEqual({
            paidUntil: "2026-12-11T00:00:00.000Z",
        })

        expect(billing.extend).toHaveBeenCalledWith("ws-1", 10)
        expect(access.audit).toHaveBeenCalledWith(ADMIN, "workspace.extend", "ws-1", {
            days: 10,
            from: "2026-12-01T00:00:00.000Z",
            to: "2026-12-11T00:00:00.000Z",
        })
    })
})

describe("AdminSupportService", () => {
    it("sets the billing status and audits from and to", async () => {
        const { support, access, billing } = await build()
        billing.setStatus.mockResolvedValue({ from: "active", to: "past_due" })

        await expect(support.setStatus(PRINCIPAL, "ws-1", "past_due")).resolves.toEqual({ status: "past_due" })

        expect(access.audit).toHaveBeenCalledWith(ADMIN, "workspace.set_status", "ws-1", {
            from: "active",
            to: "past_due",
        })
    })
})

describe("AdminSupportService", () => {
    it("moves the workspace to a plan with its own credits and audits it", async () => {
        const { support, access, billing, quotas } = await build()
        billing.setPlan.mockResolvedValue({ from: "starter", to: "enterprise" })

        await expect(support.setPlan(PRINCIPAL, "ws-1", "enterprise", 5000)).resolves.toEqual({
            planCode: "enterprise",
            creditsLimit: 5000,
        })

        expect(quotas.setCreditsLimit).toHaveBeenCalledWith("ws-1", 5000)
        expect(access.audit).toHaveBeenCalledWith(ADMIN, "workspace.set_plan", "ws-1", {
            from: "starter",
            to: "enterprise",
            creditsTo: 5000,
        })
    })
})

describe("AdminSupportService", () => {
    it("sets no credits when the plan is refused", async () => {
        const { support, quotas, billing } = await build()
        billing.setPlan.mockRejectedValue(new Error("unknown plan"))

        await expect(support.setPlan(PRINCIPAL, "ws-1", "gone", null)).rejects.toThrow("unknown plan")
        expect(quotas.setCreditsLimit).not.toHaveBeenCalled()
    })
})

describe("AdminSupportService", () => {
    it("reissues the invitation and audits it", async () => {
        const { support, access, invites } = await build()
        invites.reissue.mockResolvedValue({
            email: "ha@nivo.vn",
            link: "https://nivo.vn/invite/t",
            delivery: "invited",
        })

        await expect(support.resendInvite(PRINCIPAL, "ws-1", "i-1")).resolves.toEqual({
            email: "ha@nivo.vn",
            delivery: "invited",
        })

        expect(invites.reissue).toHaveBeenCalledWith("ws-1", "i-1")
        expect(access.audit).toHaveBeenCalledWith(ADMIN, "invite.resend", "ws-1", {
            inviteId: "i-1",
            email: "ha@nivo.vn",
            delivery: "invited",
        })
    })
})

describe("AdminSupportService", () => {
    it("refuses a caller who is not an admin before anything is changed", async () => {
        const { support, access, billing } = await build()
        access.requireAdmin.mockImplementation(() => {
            throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
        })

        await expect(support.extendSubscription(PRINCIPAL, "ws-1", 10)).rejects.toMatchObject({
            code: PlatformAdminErrorCode.NotFound,
        })
        expect(billing.extend).not.toHaveBeenCalled()
    })
})
