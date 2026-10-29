import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ConnectionsService } from "@modules/domain/connections"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { MessagesService } from "@modules/domain/messages"
import { EventsService } from "@modules/domain/events"
import { InjectTelegram } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { VideoWorkbenchService } from "./video-workbench.service"
import { VideoMediaService } from "./video-media.service"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import type { VideoShareResult } from "./video-sharing.contracts"
import { listWorkbenchProjects } from "./persistence/video-workbench.query"

@Injectable()
/** Sends an approved video's download link to the owner's Office and connected Telegram chat. */
export class VideoSharingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectTelegram() private readonly telegram: TelegramClient,
        private readonly workbench: VideoWorkbenchService,
        private readonly media: VideoMediaService,
        private readonly connections: ConnectionsService,
        private readonly secrets: ConnectionSecretsService,
        private readonly messages: MessagesService,
        private readonly events: EventsService,
    ) {}

    /** Shares only a completed, approved render in the manager's workspace. */
    async share(principalId: string, workspaceId: string, projectId: string): Promise<VideoShareResult> {
        const { member, project } = await this.workbench.managed(principalId, workspaceId, projectId)
        if (!["approved", "published"].includes(project.status))
            throw new VideoError({ code: VideoErrorCode.NotApproved })
        const [row] = await listWorkbenchProjects(this.entityManager, workspaceId, projectId, true)
        const path = row?.render?.status === "done" ? row.render.output_path : null
        if (path === null) throw new VideoError({ code: VideoErrorCode.NotApproved })
        const url = await this.media.shareLink(workspaceId, path)
        const text = `${project.title}\n${url}`
        const office = await this.messages
            .postSystem({ manager: this.entityManager, workspaceId, leadId: null, body: text })
            .then(
                () => true,
                () => false,
            )
        const connections = await this.connections.listByProvider(workspaceId, "telegram", {
            includeDisconnected: false,
        })
        const sent = await Promise.all(
            connections
                .filter((connection) => connection.status === "connected")
                .map(async (connection) => {
                    const chat = connection.meta.owner_chat_id
                    if (typeof chat !== "string" || chat === "") return false
                    const token = await this.secrets.botToken(workspaceId, connection.id)
                    if (token.kind !== "ok") return false
                    return this.telegram.sendMessage(token.value, chat, text).then(
                        () => true,
                        () => false,
                    )
                }),
        )
        await this.events.record({
            workspaceId,
            kind: "video.shared",
            actor: member.displayName,
            summary: project.title,
        })
        return { office, telegram: sent.some(Boolean) }
    }
}
