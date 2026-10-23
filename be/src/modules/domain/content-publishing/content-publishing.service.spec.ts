import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ContentApprovalStoreService, ContentEditorService } from "@modules/domain/content-items"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ContentItem } from "@modules/domain/content-items"
import { ContentPublishingService } from "./content-publishing.service"
import type { MarkContentPublishedRequest, SubmitContentRequest } from "./content-publishing.contracts"
import { ContentPublishingErrorCode } from "./errors/content-publishing.error"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

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
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params ?? {})}`)
    members.require.mockResolvedValue({
        userId: "owner-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    return { service: moduleRef.get(ContentPublishingService), members, items, store, engine, works, events, catalog }
}

const itemOf = (overrides: Partial<ContentItem> = {}): ContentItem => ({
    id: "item-1",
    workspaceId: "ws-1",
    planId: null,
    title: "Tea",
    brief: "",
    pillarId: null,
    channels: ["facebook"],
    scheduledAt: "2026-10-20T00:00:00.000Z",
    status: "draft",
    variants: { facebook: { text: "Hello", hashtags: [], note: "" } },
    hashtags: [],
    media: [],
    links: [],
    holidayKey: null,
    evidence: [],
    published: {},
    workItemId: null,
    draftedAt: AT,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    source: "manual",
    createdBy: "Lan",
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
})

describe("ContentPublishingService", () => {
    it("does not open a draft when the caller is not a manager of the workspace", async () => {
        const { service, members, items } = await build()
        const denied = new Error("not a member")
        members.require.mockRejectedValue(denied)

        await expect(service.submit("owner-1", REQUEST)).rejects.toBe(denied)
        expect(items.get).not.toHaveBeenCalled()
    })

    it("submits a complete draft and links it to the gate before the decision is visible", async () => {
        const { service, members, items, store, engine } = await build()
        items.get.mockResolvedValue(
            itemOf({ evidence: [{ at: AT, kind: "submitted", by: "Lan", text: "earlier" }], workItemId: "work-0" }),
        )
        const work = mock<WorkItem>({ id: "work-1", status: "waiting_decision" })
        engine.runWork.mockImplementation(async (_ctx, input) => {
            expect(input.onInserted).toBeDefined()
            await input.onInserted?.(work)
            return work
        })

        await expect(service.submit("owner-1", REQUEST)).resolves.toEqual({
            id: "item-1",
            workItemId: "work-1",
            status: "waiting_decision",
        })
        expect(members.require).toHaveBeenCalledWith("owner-1", "ws-1", ["owner", "manager"])
        expect(store.claimSubmission).toHaveBeenCalledWith(
            "ws-1",
            "item-1",
            "work-1",
            {
                at: AT,
                kind: "submitted",
                by: "Lan",
                text: 'contentPublishing.submitted:{"who":"Lan","id":"work-1"}',
            },
            expect.objectContaining({ id: "item-1" }),
        )
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "Lan", locale: "en" },
            expect.objectContaining({
                dedupeKey: `publish_post:item-1:work-0:2:${AT}`,
                seed: objectLike({
                    draft: "Hello",
                    fields: {
                        content_item_id: "item-1",
                        channels: "facebook",
                        scheduled_at: "2026-10-20T00:00:00.000Z",
                    },
                }),
            }),
        )
    })
})

describe("ContentPublishingService", () => {
    it("uses the first-round key when the draft has no schedule and no work item yet", async () => {
        const { service, items, engine } = await build()
        items.get.mockResolvedValue(
            itemOf({
                scheduledAt: null,
                channels: ["zalo", "facebook"],
                variants: {
                    zalo: { text: "Xin chao", hashtags: [], note: "" },
                    facebook: { text: "Hello", hashtags: [], note: "" },
                },
            }),
        )
        const work = mock<WorkItem>({ id: "work-1", status: "waiting_decision" })
        engine.runWork.mockResolvedValue(work)

        await expect(service.submit("owner-1", REQUEST)).resolves.toMatchObject({ workItemId: "work-1" })
        expect(engine.runWork).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                dedupeKey: `publish_post:item-1:first:1:${AT}`,
                seed: objectLike({
                    draft: "Xin chao",
                    fields: objectLike({ channels: "zalo,facebook", scheduled_at: "" }),
                }),
            }),
        )
    })

    it("retains a sparse channel list and uses an empty seed when its first entry is absent", async () => {
        const { service, items, engine } = await build()
        const channels = Array<string>(2)
        channels[1] = "facebook"
        items.get.mockResolvedValue(itemOf({ channels }))
        const work = mock<WorkItem>({ id: "work-1", status: "waiting_decision" })
        engine.runWork.mockResolvedValue(work)

        await expect(service.submit("owner-1", REQUEST)).resolves.toEqual({
            id: "item-1",
            workItemId: "work-1",
            status: "waiting_decision",
        })
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "Lan", locale: "en" },
            expect.objectContaining({
                dedupeKey: `publish_post:item-1:first:1:${AT}`,
                seed: {
                    summary: 'contentPublishing.summary:{"title":"Tea","channels":", facebook"}',
                    draft: "",
                    fields: {
                        content_item_id: "item-1",
                        channels: ",facebook",
                        scheduled_at: "2026-10-20T00:00:00.000Z",
                    },
                },
            }),
        )
    })
})

describe("ContentPublishingService", () => {
    it.each([
        ["an idea", itemOf({ status: "idea" }), ContentPublishingErrorCode.NotDrafted],
        ["a post that is not a draft", itemOf({ status: "approved" }), ContentPublishingErrorCode.WrongStatus],
        ["a draft with no channel", itemOf({ channels: [] }), ContentPublishingErrorCode.TextMissing],
        [
            "a blank channel text",
            itemOf({ variants: { facebook: { text: "  ", hashtags: [], note: "" } } }),
            ContentPublishingErrorCode.TextMissing,
        ],
        ["a channel with no variant", itemOf({ variants: {} }), ContentPublishingErrorCode.TextMissing],
    ])("refuses %s", async (_label, item, code) => {
        const { service, items, engine } = await build()
        items.get.mockResolvedValue(item)
        await expect(service.submit("owner-1", REQUEST)).rejects.toMatchObject({ code })
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("marks the gate failed and rethrows when the draft link is refused", async () => {
        const { service, items, store, engine, works } = await build()
        const cause = new Error("claim refused")
        items.get.mockResolvedValue(itemOf())
        store.claimSubmission.mockRejectedValue(cause)
        const work = mock<WorkItem>({ id: "work-1", status: "waiting_decision" })
        engine.runWork.mockImplementation(async (_ctx, input) => {
            expect(input.onInserted).toBeDefined()
            await input.onInserted?.(work)
            return work
        })

        await expect(service.submit("owner-1", REQUEST)).rejects.toBe(cause)
        expect(works.markFailed).toHaveBeenCalledWith("work-1", ContentPublishingErrorCode.GateFailed)
    })

    it("records the failure and refuses when the gate itself fails", async () => {
        const { service, items, store, engine } = await build()
        items.get.mockResolvedValue(itemOf())
        const work = mock<WorkItem>({ id: "work-1", status: "failed" })
        engine.runWork.mockResolvedValue(work)

        await expect(service.submit("owner-1", REQUEST)).rejects.toMatchObject({
            code: ContentPublishingErrorCode.GateFailed,
        })
        expect(store.reject).toHaveBeenCalledWith("ws-1", "item-1", "work-1", {
            at: AT,
            kind: "submission_failed",
            by: "Lan",
            text: "contentPublishing.failed:{}",
        })
    })
})

describe("ContentPublishingService", () => {
    it("records manual proof for an approved channel and the publication event", async () => {
        const { service, items, store, events } = await build()
        const published = { id: "item-1", allDone: false }
        items.get.mockResolvedValue(itemOf({ status: "approved" }))
        store.markPublished.mockResolvedValue(published)
        const request: MarkContentPublishedRequest = {
            ...REQUEST,
            channel: "facebook",
            url: " https://facebook.com/posts/1 ",
            how: " posted by hand ",
        }

        await expect(service.markPublished("owner-1", request)).resolves.toBe(published)
        expect(store.markPublished).toHaveBeenCalledWith(
            "ws-1",
            "item-1",
            "facebook",
            { at: AT, by: "Lan", url: "https://facebook.com/posts/1", how: "posted by hand" },
            {
                at: AT,
                kind: "published",
                by: "Lan",
                text:
                    'contentPublishing.published:{"who":"Lan","channel":"facebook' +
                    '","proof":"https://facebo' +
                    'ok.com/posts/1"}',
            },
        )
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "content.published",
            actor: "Lan",
            summary: 'contentPublishing.event:{"title":"Tea","channel":"facebook"}',
            evidence: "https://facebook.com/posts/1",
        })
    })

    it("uses the default note when the member gives no url and no how", async () => {
        const { service, items, store, events, catalog } = await build()
        items.get.mockResolvedValue(itemOf({ status: "published", channels: ["zalo", "facebook"] }))
        store.markPublished.mockResolvedValue({ id: "item-1", allDone: true })

        await expect(
            service.markPublished("owner-1", { ...REQUEST, channel: "zalo", url: "  ", how: " " }),
        ).resolves.toEqual({ id: "item-1", allDone: true })
        expect(catalog.get).toHaveBeenCalledWith("contentPublishing.defaultHow", {}, "en")
        expect(store.markPublished).toHaveBeenCalledWith(
            "ws-1",
            "item-1",
            "zalo",
            expect.objectContaining({ url: "", how: "contentPublishing.defaultHow:{}" }),
            expect.objectContaining({
                text:
                    'contentPublishing.published:{"who":"Lan","channel":"zalo","p' +
                    'roof":"contentPublishing.' +
                    'defaultHow:{}"}',
            }),
        )
        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ evidence: "contentPublishing.defaultHow:{}" }),
        )
    })
})

describe("ContentPublishingService", () => {
    it.each([
        [
            "a draft",
            itemOf(),
            { ...REQUEST, channel: "facebook", url: "", how: "by hand" },
            ContentPublishingErrorCode.WrongStatus,
        ],
        [
            "an unknown channel",
            itemOf({ status: "approved" }),
            { ...REQUEST, channel: "sms", url: "", how: "by hand" },
            ContentPublishingErrorCode.ChannelInvalid,
        ],
        [
            "a channel the post does not use",
            itemOf({ status: "approved" }),
            { ...REQUEST, channel: "tiktok", url: "", how: "by hand" },
            ContentPublishingErrorCode.ChannelInvalid,
        ],
        [
            "a proof link that is not http",
            itemOf({ status: "approved" }),
            { ...REQUEST, channel: "facebook", url: "ftp://files", how: "by hand" },
            ContentPublishingErrorCode.UrlInvalid,
        ],
    ])("refuses mark published for %s", async (_label, item, request, code) => {
        const { service, items, store } = await build()
        items.get.mockResolvedValue(item)
        await expect(service.markPublished("owner-1", request)).rejects.toMatchObject({ code })
        expect(store.markPublished).not.toHaveBeenCalled()
    })
})
