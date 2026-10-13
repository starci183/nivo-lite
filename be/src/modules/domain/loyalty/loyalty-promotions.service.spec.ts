import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import type { Segment } from "@modules/domain/loyalty-campaigns"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LoyaltyPromotionsService } from "./loyalty-promotions.service"

const SEGMENT: Segment = { tiers: ["bac"], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }
const ACTOR = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager" as const,
    staffId: null,
    displayName: "Owner Anna",
    status: "active" as const,
}

const build = async () => {
    const access = mock<WorkspaceMembersService>()
    access.require.mockResolvedValue(ACTOR)
    const campaigns = mock<LoyaltyCampaignsService>()
    campaigns.preview.mockResolvedValue({ total: 3, reachable: 2, sample: [] })
    campaigns.create.mockResolvedValue({ campaignId: "k1", status: "draft", recipients: 3, draft: "Hello" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyPromotionsService,
            { provide: WorkspaceMembersService, useValue: access },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyPromotionsService), access, campaigns }
}

describe("LoyaltyPromotionsService", () => {
    it("previews a segment for any member", async () => {
        const { service, access, campaigns } = await build()

        await expect(service.preview("user-1", { workspaceId: "ws-1", segment: SEGMENT })).resolves.toEqual({
            total: 3,
            reachable: 2,
            sample: [],
        })

        expect(access.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(campaigns.preview).toHaveBeenCalledWith("ws-1", SEGMENT)
    })

    it("drafts a promotion in the name of the manager who asks", async () => {
        const { service, access, campaigns } = await build()

        await expect(
            service.draft("user-1", { workspaceId: "ws-1", segment: SEGMENT, name: "Autumn", brief: "10 percent" }),
        ).resolves.toMatchObject({
            campaignId: "k1",
        })

        expect(access.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(campaigns.create).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            name: "Autumn",
            segment: SEGMENT,
            brief: "10 percent",
            createdBy: "Owner Anna",
        })
    })
})
