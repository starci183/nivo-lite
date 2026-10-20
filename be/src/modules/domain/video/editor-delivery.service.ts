import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { VideoDelegationsService } from "@modules/domain/video-delegations"
import type { DelegationRenderRow } from "@modules/domain/video-delegations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { channelNames, secondsOf, videoReadyCard } from "./editor-delegation.policy"
import type { EditorLabels, ReadyVideo } from "./editor-delegation.contracts"
import { EditorRoomService } from "./editor-room.service"
import { VideoMediaService } from "./video-media.service"
import { readScript } from "./video-script.policy"

@Injectable()
/**
 * Brings a delegated render back to the room that asked. When the render is done, AI Editor opens a publish_video work item (with the
 * key the workbench approve button uses, so either surface decides the same item), posts the video_ready card whose buttons decide it
 * and asks for the approval in one line; when it failed, AI Editor says so in one line. Each delegation is settled once.
 */
export class EditorDeliveryService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly engine: WorkEngineService,
        private readonly media: VideoMediaService,
        private readonly room: EditorRoomService,
        private readonly delegations: VideoDelegationsService,
    ) {}

    /** Settles the delegation of a render that finished or failed; a render nobody delegated changes nothing. */
    async settle(renderId: string): Promise<void> {
        const row = await this.delegations.ofSettledRender(renderId)
        if (row === null) return
        const ctx: WorkContext = { workspaceId: row.workspace_id, actor: "AI Editor", locale: "vi" }
        if (row.render_status !== "done" || row.output_path === null) {
            if (await this.delegations.markFailed(row.id, row.error)) {
                const reason = row.error ?? "render failed"
                await this.room.say(
                    ctx,
                    this.text("video.editor.failed", { title: row.title, reason }),
                    row.work_item_id,
                )
            }
            return
        }
        if (!(await this.delegations.markReady(row.id))) return
        const video = await this.readyVideo(row, row.output_path)
        const labels = this.labels(row, video)
        const approval = await this.engine.runWork(ctx, {
            action: "publish_video",
            subject_type: "video_project",
            subject_id: row.project_id,
            parent_id: row.work_item_id,
            origin: "live",
            preset: true,
            noChain: true,
            forceAsk: "over_authority",
            dedupeKey: `publish_video:${row.project_id}:${row.render_id}`,
            seed: {
                summary: row.title,
                draft: video.scenes.map((scene) => scene.caption).join("\n"),
                fields: {
                    project_id: row.project_id,
                    render_id: row.render_id,
                    title: row.title,
                    channels: row.channels.join(","),
                },
            },
        })
        const card = videoReadyCard(video, labels, approval.id)
        const seconds = secondsOf(row.duration_ms)
        await this.room.post(
            ctx,
            this.text("video.editor.ready", { title: row.title, seconds }),
            card,
            row.work_item_id,
        )
        await this.room.say(ctx, this.text("video.editor.approval", { title: row.title }), approval.id)
        await this.delegations.saveCard(row.id, approval.id, card)
    }

    private async readyVideo(row: DelegationRenderRow, output: string): Promise<ReadyVideo> {
        const link = (path: string | null): Promise<string | null> =>
            path === null ? Promise.resolve(null) : this.media.shareLink(row.workspace_id, path)
        return {
            delegationId: row.id,
            projectId: row.project_id,
            renderId: row.render_id,
            title: row.title,
            aspect: row.aspect,
            scenes: readScript(row.script),
            durationMs: row.duration_ms,
            channels: row.channels,
            source: row.source_module,
            videoUrl: await this.media.shareLink(row.workspace_id, output),
            posterUrl: await link(row.poster_path),
            captionsUrl: await link(row.captions_path),
            captionsLang: row.captions_lang,
            href: `/agents/video/workbench?focus=${row.project_id}`,
        }
    }

    private labels(row: DelegationRenderRow, video: ReadyVideo): EditorLabels {
        return {
            length: this.text("video.editor.length"),
            seconds: this.text("video.editor.seconds", { seconds: secondsOf(row.duration_ms) }),
            aspect: this.text("video.editor.aspect"),
            captions: this.text("video.editor.captions"),
            captionsOn: this.text("video.editor.captionsOn"),
            captionsOff: this.text("video.editor.captionsOff"),
            voice: this.text("video.editor.voice"),
            voiceValue: this.voiceOf(row.voiceover),
            channels: this.text("video.editor.channels"),
            noChannels: this.text("video.editor.noChannels"),
            poster: this.text("video.editor.poster"),
            frame: this.text("video.editor.frame"),
            frameOn: this.text("video.editor.frameOn"),
            link: this.text("video.editor.link"),
            approvalBody: this.text("video.editor.approvalBody", { channels: channelNames(video.channels) }),
            approvalBadge: this.text("video.editor.approvalBadge"),
        }
    }

    /** How the voice of the render went, in words: the AI voice, captions only (no provider, or it failed), or no words to speak. */
    private voiceOf(voiceover: string | null): string {
        if (voiceover === "tts") return this.text("video.editor.voice.tts")
        if (voiceover === "captions_only") return this.text("video.editor.voice.captions_only")
        return this.text("video.editor.voice.none")
    }

    private text(key: string, params: Record<string, string | number> = {}): string {
        return this.catalog.get(key, params, "vi")
    }
}
