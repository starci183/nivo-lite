import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionSecretsErrorCode, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { EventsService } from "@modules/domain/events"
import { MessagesService } from "@modules/domain/messages"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { TELEGRAM } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import type { StoredProject, StoredRender } from "./video-stored.contracts"
import { VideoMediaService } from "./video-media.service"
import { VideoWorkbenchReadsService } from "./video-workbench-reads.service"
import { VideoSharingService } from "./video-sharing.service"
import type { WorkbenchProject } from "./video-workbench.contracts"
import { VideoWorkbenchService } from "./video-workbench.service"

const WS = "workspace-1"
const OUTPUT = `${WS}/render-1/video.mp4`
const LINK = "https://cdn/video.mp4?token=1"

const MEMBER: WorkspaceMember = {
    userId: "person-1",
    workspaceId: WS,
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const projectOf = builder<WorkbenchProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    targetSeconds: 30,
    status: "approved",
    inputs: { sourceIds: [], notes: "", media: [], auto: false },
    script: [],
    version: 2,
    scriptMs: null,
    lastErrorCode: null,
    render: null,
    renderCount: 1,
    approvedAt: "2026-10-13T10:00:00.000Z",
    approvedByName: "Lan",
    publishedAt: null,
    createdAt: "2026-10-13T09:00:00.000Z",
    updatedAt: "2026-10-13T10:00:00.000Z",
})

const renderOf = builder<StoredRender>({
    id: "render-1",
    status: "done",
    progress: 100,
    stage: null,
    duration_ms: 15_000,
    size_bytes: 2048,
    output_path: OUTPUT,
    poster_path: null,
})

const rowOf = builder<StoredProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "approved",
    inputs: {},
    script: [],
    version: 2,
    script_ms: null,
    last_error: null,
    render_id: "render-1",
    render_ids: ["render-1"],
    approved_at: null,
    approved_by_name: null,
    published_at: null,
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: "2026-10-13T09:00:00.000Z",
    render: renderOf(),
})

const connectionOf = builder<ConnectionRecord>({
    id: "connection-1",
    workspaceId: WS,
    provider: "telegram",
    name: "Shop bot",
    meta: { owner_chat_id: "chat-1" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "person-1",
    createdAt: "2026-10-01T00:00:00.000Z",
})

/** A reads double that answers the workbench list with `rows`. */
const readsOf = (rows: ReadonlyArray<StoredProject>) => {
    const reads = mock<VideoWorkbenchReadsService>()
    reads.projectsOf.mockResolvedValue([...rows])
    return reads
}

const build = async (
    reads: VideoWorkbenchReadsService = readsOf([rowOf()]),
    project: WorkbenchProject = projectOf(),
) => {
    const em = mockEntityManager()
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    const workbench = mock<VideoWorkbenchService>()
    workbench.managed.mockResolvedValue({ member: MEMBER, project })
    const media = mock<VideoMediaService>()
    media.shareLink.mockResolvedValue(LINK)
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue([connectionOf()])
    const secrets = mock<ConnectionSecretsService>()
    secrets.botToken.mockResolvedValue(ok("bot-token"))
    const messages = mock<MessagesService>()
    messages.postSystem.mockResolvedValue(undefined)
    const events = mock<EventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoSharingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: TELEGRAM, useValue: telegram },
            { provide: VideoWorkbenchService, useValue: workbench },
            { provide: VideoWorkbenchReadsService, useValue: reads },
            { provide: VideoMediaService, useValue: media },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: MessagesService, useValue: messages },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return {
        sharing: moduleRef.get(VideoSharingService),
        em,
        reads,
        telegram,
        media,
        connections,
        secrets,
        messages,
        events,
    }
}

describe("VideoSharingService", () => {
    describe("share", () => {
        it("posts the download link to Office and the owner's Telegram chat and records the share", async () => {
            const { sharing, em, reads, telegram, media, connections, messages, events } = await build()

            await expect(sharing.share("person-1", WS, "project-1")).resolves.toEqual({ office: true, telegram: true })

            const text = `Spring offer\n${LINK}`
            expect(reads.projectsOf).toHaveBeenCalledWith(WS, "project-1", true)
            expect(media.shareLink).toHaveBeenCalledWith(WS, OUTPUT)
            expect(messages.postSystem).toHaveBeenCalledWith({ manager: em, workspaceId: WS, leadId: null, body: text })
            expect(connections.listByProvider).toHaveBeenCalledWith(WS, "telegram", { includeDisconnected: false })
            expect(telegram.sendMessage).toHaveBeenCalledWith("bot-token", "chat-1", text)
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: WS,
                kind: "video.shared",
                actor: "Lan",
                summary: "Spring offer",
            })
        })

        it("reports each channel that could not be reached", async () => {
            const { sharing, telegram, messages } = await build()
            const failure = new VideoError({ code: VideoErrorCode.StorageFailed, params: { path: "x" } })
            messages.postSystem.mockRejectedValue(failure)
            telegram.sendMessage.mockRejectedValue(failure)

            await expect(sharing.share("person-1", WS, "project-1")).resolves.toEqual({
                office: false,
                telegram: false,
            })
        })

        it("skips connections that are not ready to send", async () => {
            const { sharing, telegram, connections, secrets } = await build()
            connections.listByProvider.mockResolvedValue([
                connectionOf({ id: "c-error", status: "error" }),
                connectionOf({ id: "c-no-chat", meta: {} }),
                connectionOf({ id: "c-no-token" }),
            ])
            secrets.botToken.mockResolvedValue(refused(ConnectionSecretsErrorCode.NotFound))

            await expect(sharing.share("person-1", WS, "project-1")).resolves.toEqual({ office: true, telegram: false })
            expect(secrets.botToken.mock.calls).toEqual([[WS, "c-no-token"]])
            expect(telegram.sendMessage).not.toHaveBeenCalled()
        })

        it("refuses a project that is not approved", async () => {
            const { sharing, media } = await build(undefined, projectOf({ status: "ready" }))

            await expect(sharing.share("person-1", WS, "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(media.shareLink).not.toHaveBeenCalled()
        })

        it.each([
            ["no row", []],
            ["no render", [rowOf({ render: null })]],
            ["an unfinished render", [rowOf({ render: renderOf({ status: "rendering" }) })]],
            ["a render with no video", [rowOf({ render: renderOf({ output_path: null }) })]],
        ])("refuses %s to share", async (_label, rows) => {
            const { sharing, media, events } = await build(readsOf(rows))

            await expect(sharing.share("person-1", WS, "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(media.shareLink).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
        })
    })
})
