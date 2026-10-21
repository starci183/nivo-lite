import { Injectable } from "@nestjs/common"
import { CommandBusService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import type { MarketingDraft } from "./content-agent.contracts"
import type { DraftImage } from "./marketing-cards.contracts"

const MAX_SCENES = 12
const MAX_TITLE = 120
const MAX_CAPTION = 160
const MAX_VOICEOVER = 420

/** The draft the video is cut from: the stored content item, its channels and the AI Marketing work item that asked. */
export interface VideoBrief {
    /** The content item of the draft. */
    readonly contentItemId: string
    /** The target channels. */
    readonly channels: ReadonlyArray<string>
    /** The AI Marketing work item, or null. */
    readonly parentId: string | null
}

/** The scenes of the editor command: one per script beat, the draft images laid over the first beats. */
export const scenesOf = (
    draft: MarketingDraft,
    images: ReadonlyArray<DraftImage>,
): ReadonlyArray<Readonly<Record<string, string | null>>> =>
    draft.script
        .filter((beat) => beat.line.trim() !== "")
        .slice(0, MAX_SCENES)
        .map((beat, index) => ({
            caption: beat.line.trim().slice(0, MAX_CAPTION),
            voiceover: beat.line.trim().slice(0, MAX_VOICEOVER),
            media: images[index]?.path ?? null,
        }))

@Injectable()
/**
 * AI Marketing -> AI Editor (`video/editor-delegation.contracts.ts`): the draft's 15 second script goes to the video agent as a
 * `render_script` command on the bus, one per content item; AI Editor renders it and answers with a `video_ready` card.
 */
export class MarketingVideoService {
    constructor(
        private readonly bus: CommandBusService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Delegates the video of a draft; answers whether AI Editor took it. A refusal or a failure is logged, never thrown. */
    async delegate(
        ctx: WorkContext,
        draft: MarketingDraft,
        images: ReadonlyArray<DraftImage>,
        brief: VideoBrief,
    ): Promise<boolean> {
        const script = scenesOf(draft, images)
        if (script.length === 0) return false
        try {
            const result = await this.bus.sendCommand(ctx, {
                from: "content",
                to: "video",
                command: "render_script",
                reason: `draft_post:${brief.contentItemId}`,
                parentId: brief.parentId,
                dedupeKey: `render_script:${brief.contentItemId}`,
                payload: {
                    subject_type: "video_project",
                    title: (draft.title.trim() === "" ? "Video" : draft.title.trim()).slice(0, MAX_TITLE),
                    script,
                    channels: brief.channels,
                    brand_kit_id: ctx.workspaceId,
                    aspect: "9:16",
                    goal: "offer",
                    content_item_id: brief.contentItemId,
                    source: "content",
                },
            })
            if (!result.ok) {
                this.logger.warn(ContentAgentLogEvent.VideoDelegationFailed, {
                    workspaceId: ctx.workspaceId,
                    refused: result.refused,
                })
            }
            return result.ok
        } catch (cause: unknown) {
            this.logger.error(ContentAgentLogEvent.VideoDelegationFailed, cause, { workspaceId: ctx.workspaceId })
            return false
        }
    }
}
