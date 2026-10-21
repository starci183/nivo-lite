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
    return { service: moduleRef.get(PublishContentPerformerService), store, registry, catalog }
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

    it("refuses a named automation actor carrying a nonhuman kind", async () => {
        const { service, store } = await build()
        const actor = { name: "bot", kind: "policy" }

        await expect(service.perform(CTX, ITEM, PROPOSAL, actor)).rejects.toMatchObject({
            code: ContentPublishingErrorCode.WrongStatus,
        })
        expect(store.approve).not.toHaveBeenCalled()
    })

    it("registers itself for publish_post", async () => {
        const { service, registry } = await build()
        service.onModuleInit()
        expect(registry.add).toHaveBeenCalledWith("publish_post", service)
    })

    it("approves when a staff member decides and keeps a missing draft as null", async () => {
        const { service, store, catalog } = await build()
        const proposal: Proposal = { summary: "Publish", fields: {} }

        await expect(service.perform(CTX, ITEM, proposal, { kind: "staff", name: "Minh" })).resolves.toEqual({
            summary: "Lan approved work-1",
            evidence: "reviewed",
        })
        expect(catalog.get).toHaveBeenCalledWith("contentPublishing.approved", { who: "Minh", id: "work-1" }, "en")
        expect(store.approve).toHaveBeenCalledWith("ws-1", "item-1", "work-1", "Minh", null, {
            at: AT,
            kind: "approved",
            by: "Minh",
            text: "Lan approved work-1",
        })
    })
})

describe("PublishContentPerformerService", () => {
    it.each([
        ["another workspace", { ...ITEM, workspace_id: "ws-2" }],
        ["no subject", { ...ITEM, subject_id: null }],
        ["another action", { ...ITEM, action: "reply_customer" }],
    ])("refuses a work item from %s", async (_label, item) => {
        const { service, store } = await build()
        await expect(service.perform(CTX, item, PROPOSAL, { kind: "owner", name: "Lan" })).rejects.toMatchObject({
            code: ContentPublishingErrorCode.WrongStatus,
        })
        expect(store.approve).not.toHaveBeenCalled()
    })

    it("returns a rejected post to draft", async () => {
        const { service, store, catalog } = await build()
        await expect(service.onReject(CTX, ITEM, PROPOSAL, { kind: "staff", name: "Minh" })).resolves.toBeUndefined()
        expect(catalog.get).toHaveBeenCalledWith("contentPublishing.rejected", { who: "Minh" }, "en")
        expect(store.reject).toHaveBeenCalledWith("ws-1", "item-1", "work-1", {
            at: AT,
            kind: "rejected",
            by: "Minh",
            text: "Lan approved work-1",
        })
    })
})
