import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient, MetaPageAccess } from "@modules/integrations/meta"
import { CLOCK } from "@modules/platform/clock"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import type { CommentTarget, DmTarget } from "./lead-flows.contracts"

const NOW = "2026-10-13T10:00:00.000Z"

const HOUR_MS = 3_600_000

const CONNECTION: ConnectionRecord = {
    id: "connection-1",
    workspaceId: "ws-1",
    provider: "meta",
    name: "Hue Tea Page",
    meta: { ig_id: "ig-1" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: NOW,
}

const PAGE: MetaPageAccess = { pageId: "page-1", pageToken: "page-token", igId: "ig-1" }

const FLOW: DmTarget = { connection_id: "connection-1", platform: "facebook", psid: "person-1", igsid: null }

const COMMENT: CommentTarget = {
    workspaceId: "ws-1",
    connectionId: "connection-1",
    platform: "facebook",
    commentId: "comment-1",
}

const build = async () => {
    const meta = mock<MetaClient>()
    const connections = mock<ConnectionsService>()
    const comments = mock<MetaCommentsService>()
    const threads = mock<MetaThreadsService>()
    connections.find.mockResolvedValue(CONNECTION)
    connections.readSecret.mockResolvedValue({
        plain: JSON.stringify({ pageId: "page-1", pageToken: "page-token" }),
        webhookSecret: "hook",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowMetaService,
            { provide: META_CLIENT, useValue: meta },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: ConnectionsService, useValue: connections },
            { provide: MetaCommentsService, useValue: comments },
            { provide: MetaThreadsService, useValue: threads },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFlowMetaService), meta, connections, comments, threads }
}

describe("LeadFlowMetaService", () => {
    it("reads the Page of a live Meta connection and nothing for a gone or unreadable one", async () => {
        const { service, connections } = await build()

        await expect(service.pageOf("ws-1", "connection-1")).resolves.toEqual(PAGE)
        await expect(service.pageOf("ws-1", null)).resolves.toBeNull()
        connections.find.mockResolvedValueOnce({ ...CONNECTION, status: "disconnected" })
        await expect(service.pageOf("ws-1", "connection-1")).resolves.toBeNull()
        connections.readSecret.mockResolvedValueOnce({ plain: "not-json", webhookSecret: "hook" })
        await expect(service.pageOf("ws-1", "connection-1")).resolves.toBeNull()

        expect(connections.find).toHaveBeenCalledWith("ws-1", "connection-1")
    })
    it("sends a direct message inside the 24 hour window", async () => {
        const { service, meta, threads } = await build()
        threads.lastUserAt.mockResolvedValue(Date.parse(NOW) - HOUR_MS)
        meta.deliverMessage.mockResolvedValue({ ok: true, ids: ["mid-1"] })

        await expect(service.sendToFlow("ws-1", FLOW, "Hello", false)).resolves.toEqual({
            ok: true,
            reason: null,
            detail: null,
        })

        expect(threads.lastUserAt).toHaveBeenCalledWith({
            connectionId: "connection-1",
            platform: "facebook",
            userId: "person-1",
        })
        expect(meta.deliverMessage).toHaveBeenCalledWith(PAGE, "facebook", "person-1", "Hello", "standard")
    })
    it("refuses a normal message after 24 hours and lets a person's tagged reply go up to 7 days", async () => {
        const { service, meta, threads } = await build()
        threads.lastUserAt.mockResolvedValue(Date.parse(NOW) - 48 * HOUR_MS)
        meta.deliverMessage.mockResolvedValue({ ok: false, reason: "token" })

        await expect(service.sendToFlow("ws-1", FLOW, "Hello", false)).resolves.toEqual({
            ok: false,
            reason: "tag_only",
            detail: null,
        })
        await expect(service.sendToFlow("ws-1", FLOW, "Hello", true)).resolves.toEqual({
            ok: false,
            reason: "failed",
            detail: "token",
        })
        await expect(service.sendToFlow("ws-1", { ...FLOW, psid: null }, "Hello", true)).resolves.toEqual({
            ok: false,
            reason: "no_recipient",
            detail: null,
        })

        expect(meta.deliverMessage.mock.calls).toEqual([[PAGE, "facebook", "person-1", "Hello", "human_agent"]])
    })
})

describe("LeadFlowMetaService", () => {
    it("claims the one private reply of a recent comment before sending it and gives it back on a failure", async () => {
        const { service, meta, comments } = await build()
        comments.replyState.mockResolvedValue({ commentAt: Date.parse(NOW) - HOUR_MS, replied: false })
        comments.claim.mockResolvedValue(true)
        meta.takePrivateReplySlots.mockReturnValue(true)
        meta.privateMessage.mockResolvedValueOnce({ ok: true, ids: ["mid-1"], recipientId: "person-9" })
        meta.privateMessage.mockResolvedValueOnce({ ok: false, reason: "token" })

        await expect(service.privateReply(COMMENT, "Hi")).resolves.toEqual({
            ok: true,
            failure: null,
            recipientId: "person-9",
        })
        await expect(service.privateReply(COMMENT, "Hi")).resolves.toEqual({
            ok: false,
            failure: "token",
            recipientId: null,
        })

        expect(comments.claim).toHaveBeenCalledWith({ connectionId: "connection-1", commentId: "comment-1" })
        expect(meta.privateMessage).toHaveBeenCalledWith(PAGE, "facebook", "comment-1", "Hi")
        expect(comments.release).toHaveBeenCalledTimes(1)
    })
    it("refuses a private reply to an old comment or one somebody already claimed, without sending", async () => {
        const { service, meta, comments } = await build()
        meta.takePrivateReplySlots.mockReturnValue(true)
        comments.replyState.mockResolvedValueOnce({ commentAt: Date.parse(NOW) - 8 * 24 * HOUR_MS, replied: false })
        comments.replyState.mockResolvedValueOnce({ commentAt: Date.parse(NOW), replied: false })
        comments.claim.mockResolvedValue(false)

        await expect(service.privateReply(COMMENT, "Hi")).resolves.toEqual({
            ok: false,
            failure: "private_reply_expired",
            recipientId: null,
        })
        await expect(service.privateReply(COMMENT, "Hi")).resolves.toEqual({
            ok: false,
            failure: "already_replied",
            recipientId: null,
        })

        expect(meta.privateMessage).not.toHaveBeenCalled()
    })
    it("ignores absent and other-provider connections and unreadable credentials", async () => {
        const { service, connections } = await build()
        connections.find.mockResolvedValueOnce(null)
        connections.find.mockResolvedValueOnce({ ...CONNECTION, provider: "google" })

        await expect(service.pageOf("ws-1", "missing")).resolves.toBeNull()
        await expect(service.pageOf("ws-1", "google-1")).resolves.toBeNull()
        expect(connections.readSecret).not.toHaveBeenCalled()

        connections.readSecret.mockResolvedValueOnce(null)
        await expect(service.pageOf("ws-1", "connection-1")).resolves.toBeNull()
        connections.find.mockResolvedValueOnce({ ...CONNECTION, meta: {} })
        await expect(service.pageOf("ws-1", "connection-1")).resolves.toEqual({ ...PAGE, igId: null })
        expect(connections.readSecret).toHaveBeenCalledWith("connection-1")
    })
})

describe("LeadFlowMetaService", () => {
    it("reads lead details, mentions and names through the supplied Page", async () => {
        const { service, meta } = await build()
        const lead = {
            name: "Lan",
            phone: "84123456789",
            email: "lan@example.com",
            fields: { need: "Tea" },
            ad_id: "ad-1",
            form_id: "form-1",
            created_at: NOW,
        }
        meta.fetchLead.mockResolvedValue(lead)
        meta.fetchMention.mockResolvedValue({ text: "@hue Tea please", username: "lan" })
        meta.fetchProfileName.mockResolvedValue("Lan")

        await expect(service.fetchLead(PAGE, "submission-1")).resolves.toBe(lead)
        await expect(service.mentionOf(PAGE, "mention-1")).resolves.toEqual({
            text: "@hue Tea please",
            username: "lan",
        })
        await expect(service.profileName(PAGE, "instagram", "ig-person")).resolves.toBe("Lan")

        expect(meta.fetchLead).toHaveBeenCalledWith(PAGE, "submission-1")
        expect(meta.fetchMention).toHaveBeenCalledWith(PAGE, "mention-1")
        expect(meta.fetchProfileName).toHaveBeenCalledWith(PAGE, "instagram", "ig-person")
    })
    it.each([
        { ...FLOW, connection_id: null },
        { ...FLOW, platform: null },
        { ...FLOW, psid: null },
    ])("closes the message window for an incomplete target %j", async (flow) => {
        const { service, threads } = await build()

        await expect(service.windowOf(flow)).resolves.toEqual({ status: "closed", msLeft: 0 })

        expect(threads.lastUserAt).not.toHaveBeenCalled()
    })
    it("sends a person's Instagram reply inside the window as a standard message", async () => {
        const { service, meta, threads } = await build()
        const flow: DmTarget = { ...FLOW, platform: "instagram", igsid: "ig-person" }
        threads.lastUserAt.mockResolvedValue(Date.parse(NOW) - HOUR_MS)
        meta.deliverMessage.mockResolvedValue({ ok: true, ids: ["mid-2"] })

        await expect(service.windowOf(flow)).resolves.toEqual({ status: "open", msLeft: 23 * HOUR_MS })
        await expect(service.sendToFlow("ws-1", flow, "A human reply", true)).resolves.toEqual({
            ok: true,
            reason: null,
            detail: null,
        })

        expect(threads.lastUserAt).toHaveBeenCalledWith({
            connectionId: "connection-1",
            platform: "instagram",
            userId: "ig-person",
        })
        expect(meta.deliverMessage).toHaveBeenCalledWith(PAGE, "instagram", "ig-person", "A human reply", "standard")
    })
})

describe("LeadFlowMetaService", () => {
    it("refuses closed windows and a missing Page before delivering", async () => {
        const { service, meta, threads, connections } = await build()
        threads.lastUserAt.mockResolvedValue(Date.parse(NOW) - 8 * 24 * HOUR_MS)

        await expect(service.sendToFlow("ws-1", { ...FLOW, platform: null }, "Hello", false)).resolves.toEqual({
            ok: false,
            reason: "window",
            detail: null,
        })
        await expect(service.sendToFlow("ws-1", FLOW, "Hello", true)).resolves.toEqual({
            ok: false,
            reason: "window",
            detail: null,
        })
        threads.lastUserAt.mockResolvedValue(Date.parse(NOW) - HOUR_MS)
        connections.find.mockResolvedValue(null)
        await expect(service.sendToFlow("ws-1", FLOW, "Hello", false)).resolves.toEqual({
            ok: false,
            reason: "not_connected",
            detail: null,
        })

        expect(meta.deliverMessage).not.toHaveBeenCalled()
    })
    it("answers publicly with the Page and reports delivery without a recipient", async () => {
        const { service, meta, connections } = await build()
        meta.publicReply.mockResolvedValueOnce({ ok: true, ids: ["comment-reply-1"] })
        meta.publicReply.mockResolvedValueOnce({ ok: false, reason: "permission" })

        await expect(service.publicReply(COMMENT, "Thank you")).resolves.toEqual({
            ok: true,
            failure: null,
            recipientId: null,
        })
        await expect(service.publicReply(COMMENT, "Another reply")).resolves.toEqual({
            ok: false,
            failure: "permission",
            recipientId: null,
        })
        connections.find.mockResolvedValue(null)
        await expect(service.publicReply(COMMENT, "No Page")).resolves.toBeNull()

        expect(meta.publicReply.mock.calls).toEqual([
            [PAGE, "facebook", "comment-1", "Thank you"],
            [PAGE, "facebook", "comment-1", "Another reply"],
        ])
    })
})

describe("LeadFlowMetaService", () => {
    it("does not claim a private reply without a Page or available rate-limit slot", async () => {
        const { service, meta, connections, comments } = await build()
        connections.find.mockResolvedValueOnce(null)

        await expect(service.privateReply(COMMENT, "Hi")).resolves.toBeNull()
        expect(comments.replyState).not.toHaveBeenCalled()

        comments.replyState.mockResolvedValue({ commentAt: Date.parse(NOW), replied: false })
        meta.takePrivateReplySlots.mockReturnValue(false)
        await expect(service.privateReply(COMMENT, "Hi")).resolves.toEqual({
            ok: false,
            failure: "rate_limited",
            recipientId: null,
        })

        expect(meta.takePrivateReplySlots).toHaveBeenCalledWith("page-1")
        expect(comments.claim).not.toHaveBeenCalled()
        expect(meta.privateMessage).not.toHaveBeenCalled()
    })
})

describe("LeadFlowMetaService", () => {
    it("retains the claim when Meta says a private reply was already sent", async () => {
        const { service, meta, comments } = await build()
        comments.replyState.mockResolvedValue({ commentAt: Date.parse(NOW), replied: false })
        comments.claim.mockResolvedValue(true)
        meta.takePrivateReplySlots.mockReturnValue(true)
        meta.privateMessage.mockResolvedValue({ ok: false, reason: "already_replied" })

        await expect(service.privateReply(COMMENT, "Hi")).resolves.toEqual({
            ok: false,
            failure: "already_replied",
            recipientId: null,
        })

        expect(comments.replyState).toHaveBeenCalledWith({ connectionId: "connection-1", commentId: "comment-1" })
        expect(meta.privateMessage).toHaveBeenCalledWith(PAGE, "facebook", "comment-1", "Hi")
        expect(comments.release).not.toHaveBeenCalled()
    })
})
