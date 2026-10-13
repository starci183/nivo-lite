import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ContentApprovalStoreService } from "@modules/domain/content-items"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ContentPublishingErrorCode } from "./errors/content-publishing.error"
import { PublishContentPerformerService } from "./publish-content-performer.service"

const AT = "2026-10-13T03:00:00.000Z"
const PROPOSAL: Proposal = { summary: "Publish the draft", draft: "Hello", fields: { content_item_id: "item-1" } }
const CTX: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }
const ITEM: WorkItem = {
    id: "work-1",
    workspace_id: "ws-1",
    department: "content",
    action: "publish_post",
    subject_type: "inbound",
    subject_id: "item-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: PROPOSAL,
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: AT,
    updated_at: AT,
    completed_at: null,
    installation_id: null,
}

const build = async () => {
    const store = mock<ContentApprovalStoreService>()
    const registry = mock<WorkPerformerRegistry>()
    const clock = new FakeClock(AT)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Lan approved work-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublishContentPerformerService,
            { provide: ContentApprovalStoreService, useValue: store },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(PublishContentPerformerService), store, registry }
}

describe("PublishContentPerformerService", () => {
    it("prepares the draft already on the work item", async () => {
        const { service } = await build()

        await expect(service.prepare(CTX, ITEM)).resolves.toEqual({ proposal: PROPOSAL })
    })

    it("approves the bound draft when an owner decides", async () => {
        const { service } = await build()

        await expect(service.perform(CTX, ITEM, PROPOSAL, { kind: "owner", name: "Lan" })).resolves.toEqual({
            summary: "Lan approved work-1",
            evidence: "reviewed",
        })
    })

    it("refuses a performer that is not an owner or a staff member", async () => {
        const { service, store } = await build()

        await expect(service.perform(CTX, ITEM, PROPOSAL, { name: "bot" })).rejects.toMatchObject({
            code: ContentPublishingErrorCode.WrongStatus,
        })
        expect(store.approve).not.toHaveBeenCalled()
    })
})
