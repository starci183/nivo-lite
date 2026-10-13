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
})
