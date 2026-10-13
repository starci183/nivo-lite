import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ContentApprovalStoreService, ContentEditorService } from "@modules/domain/content-items"
import { WorkEngineService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ContentPublishingService } from "./content-publishing.service"
import type { SubmitContentRequest } from "./content-publishing.contracts"

const AT = "2026-10-13T03:00:00.000Z"
const REQUEST: SubmitContentRequest = { workspaceId: "ws-1", id: "item-1", locale: "en" }

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const items = mock<ContentEditorService>()
    const store = mock<ContentApprovalStoreService>()
    const engine = mock<WorkEngineService>()
    const works = mock<WorkItemsService>()
    const events = mock<EventsService>()
    const clock = new FakeClock(AT)
    const catalog = mock<MessageCatalog>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentPublishingService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ContentEditorService, useValue: items },
            { provide: ContentApprovalStoreService, useValue: store },
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkItemsService, useValue: works },
            { provide: EventsService, useValue: events },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(ContentPublishingService), members, items }
}

describe("ContentPublishingService", () => {
    it("does not open a draft when the caller is not a manager of the workspace", async () => {
        const { service, members, items } = await build()
        const denied = new Error("not a member")
        members.require.mockRejectedValue(denied)

        await expect(service.submit("owner-1", REQUEST)).rejects.toBe(denied)
        expect(items.get).not.toHaveBeenCalled()
    })
})
