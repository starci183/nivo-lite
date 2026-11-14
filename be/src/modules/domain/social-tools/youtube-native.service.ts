import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { YoutubePublishRegistryService, type YoutubeVideo } from "@modules/domain/provider-registry"
import { socialAccountOf } from "./social-account.policy"
import { socialFailureOf } from "./social-refusal.policy"
import { SOCIAL_TOOL_NAME } from "./social-tools.tool-ids"
import {
    YOUTUBE_VIDEO_PUBLISH_INPUT_SCHEMA,
    YOUTUBE_VIDEO_PUBLISH_SCHEMA,
    YOUTUBE_VIDEO_STATUS_GET_INPUT_SCHEMA,
    YOUTUBE_VIDEO_STATUS_GET_SCHEMA,
} from "./youtube-native.schema"
import { DomainError } from "@modules/platform/errors"

/**
 * The YouTube DESTINATION tools. YouTube is a domain, not a generic purpose: its contract is its own (title, tags, category, privacy,
 * playlist) and no other destination substitutes it. Publishing is upload + status: the call uploads the file and answers the video id;
 * YouTube processes it afterwards and `status.get` reads where it stands.
 */
export const YOUTUBE_MANIFEST: ToolManifest = {
    key: "youtube",
    namespace: "nivo.tool",
    name: "YouTube",
    contractVersion: "youtube-native@1",
    timeoutMs: 600_000,
    tools: [
        {
            name: SOCIAL_TOOL_NAME.youtubeVideoPublish,
            description:
                "Uploads a video of the file store to the connected YouTube channel (title, description, tags, category, privacy, optional playlist). Answers the video id and its state: poll it with `nivo.tool.youtube.video.status.get`.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: YOUTUBE_VIDEO_PUBLISH_INPUT_SCHEMA,
            argumentSchema: YOUTUBE_VIDEO_PUBLISH_SCHEMA,
            domain: TOOL.youtubeVideoPublish,
            internalOnly: true,
        },
        {
            name: SOCIAL_TOOL_NAME.youtubeVideoStatusGet,
            description: "Where a YouTube video stands (pending, done, failed with YouTube's reason) and its privacy status.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: YOUTUBE_VIDEO_STATUS_GET_INPUT_SCHEMA,
            argumentSchema: YOUTUBE_VIDEO_STATUS_GET_SCHEMA,
            domain: TOOL.youtubeVideoStatusGet,
            internalOnly: true,
        },
    ],
}

const answerOf = (video: YoutubeVideo): ToolJson => ({
    videoId: video.videoId,
    state: video.state,
    uploadStatus: video.uploadStatus,
    reason: video.reason,
    privacyStatus: video.privacyStatus,
    processingStatus: video.processingStatus,
    playlistItemId: video.playlistItemId,
    playlistFailure: video.playlistFailure,
})

@Injectable()
/** The YouTube publishing tools for internal callers, run by the account the tool runner handed (never a silent pick). */
export class YoutubeNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = YOUTUBE_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly registry: YoutubePublishRegistryService,
    ) {}

    /** Runs one YouTube tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            switch (tool) {
                case SOCIAL_TOOL_NAME.youtubeVideoPublish: {
                    const asked = argumentsOf(tool, YOUTUBE_VIDEO_PUBLISH_SCHEMA, args)
                    const { connection, port } = await socialAccountOf(this.connections, this.registry, workspaceId, caller)
                    return answerOf(
                        await port.publish(workspaceId, connection, {
                            video: { fileId: asked.videoFileId },
                            title: asked.title,
                            description: asked.description ?? "",
                            tags: asked.tags ?? [],
                            categoryId: asked.categoryId ?? null,
                            privacyStatus: asked.privacyStatus ?? null,
                            publishAt: asked.publishAt ?? null,
                            madeForKids: asked.madeForKids ?? null,
                            notifySubscribers: asked.notifySubscribers ?? null,
                            thumbnail: asked.thumbnailFileId === undefined ? null : { fileId: asked.thumbnailFileId },
                            playlistId: asked.playlistId ?? null,
                        }),
                    )
                }
                case SOCIAL_TOOL_NAME.youtubeVideoStatusGet: {
                    const asked = argumentsOf(tool, YOUTUBE_VIDEO_STATUS_GET_SCHEMA, args)
                    const { connection, port } = await socialAccountOf(this.connections, this.registry, workspaceId, caller)
                    return answerOf(await port.status(connection, asked.videoId))
                }
                default:
                    throw unknownTool(tool)
            }
        } catch (cause) {
            const failure = socialFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
