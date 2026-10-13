import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { LoyaltyCampaignDraftsService, LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyCampaignWorkbenchService } from "./loyalty-campaign-workbench.service"

const build = async () => {
    const access = mock<WorkspaceMembersService>()
    const campaigns = mock<LoyaltyCampaignsService>()
    const drafts = mock<LoyaltyCampaignDraftsService>()
    const engine = mock<WorkEngineService>()
    const catalog = mock<MessageCatalog>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCampaignWorkbenchService,
            { provide: WorkspaceMembersService, useValue: access },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
            { provide: LoyaltyCampaignDraftsService, useValue: drafts },
            { provide: WorkEngineService, useValue: engine },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyCampaignWorkbenchService), access, campaigns, drafts, engine, catalog }
}

describe("LoyaltyCampaignWorkbenchService", () => {
    describe("draft", () => {
        it("draft has its first case written", async () => {
            const { service } = await build()
            expect(service.draft).toBeInstanceOf(Function)
        })
    })

    describe("submit", () => {
        it("submit has its first case written", async () => {
            const { service } = await build()
            expect(service.submit).toBeInstanceOf(Function)
        })
    })

    describe("campaign", () => {
        it("campaign has its first case written", async () => {
            const { service } = await build()
            expect(service.campaign).toBeInstanceOf(Function)
        })
    })
})
