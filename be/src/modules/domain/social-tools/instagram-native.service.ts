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
import { InstagramPublishRegistryService, type InstagramContainer } from "@modules/domain/provider-registry"
import {
    INSTAGRAM_MEDIA_PUBLISH_INPUT_SCHEMA,
    INSTAGRAM_MEDIA_PUBLISH_SCHEMA,
    INSTAGRAM_MEDIA_STATUS_GET_INPUT_SCHEMA,
    INSTAGRAM_MEDIA_STATUS_GET_SCHEMA,
} from "./instagram-native.schema"
import { socialAccountOf } from "./social-account.policy"
import { socialFailureOf } from "./social-refusal.policy"
import { SOCIAL_TOOL_NAME } from "./social-tools.tool-ids"
import { DomainError } from "@modules/platform/errors"

/**
 * The Instagram DESTINATION tools. Instagram is a domain, not a generic purpose: its contract is its own (media type, public media
 * addresses, carousel items) and no other destination substitutes it. Publishing is create + status: a container is created and
 * published at once when Instagram has already processed it, else the call answers the container and `status.get` goes on.
 */
export const INSTAGRAM_MANIFEST: ToolManifest = {
    key: "instagram",
    namespace: "nivo.tool",
    name: "Instagram",
    contractVersion: "instagram-native@1",
    timeoutMs: 90_000,
    tools: [
        {
            name: SOCIAL_TOOL_NAME.instagramMediaPublish,
            description:
                "Publishes an image, video, reel or carousel (by public https address) to the connected Instagram account. Answers the container and its state: `published` with the media id, or `pending`: poll it with `nivo.tool.instagram.media.status.get`, then call this again with only the `containerId` to publish it. A call with only a `containerId` publishes that finished container.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: INSTAGRAM_MEDIA_PUBLISH_INPUT_SCHEMA,
            argumentSchema: INSTAGRAM_MEDIA_PUBLISH_SCHEMA,
            domain: TOOL.instagramMediaPublish,
            internalOnly: true,
        },
        {
            name: SOCIAL_TOOL_NAME.instagramMediaStatusGet,
            description:
                "Where an Instagram container stands (pending, ready, published, failed). A read: to publish a ready container call `nivo.tool.instagram.media.publish` with its `containerId`.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: INSTAGRAM_MEDIA_STATUS_GET_INPUT_SCHEMA,
            argumentSchema: INSTAGRAM_MEDIA_STATUS_GET_SCHEMA,
            domain: TOOL.instagramMediaStatusGet,
            internalOnly: true,
        },
    ],
}

const answerOf = (container: InstagramContainer): ToolJson => ({
    containerId: container.containerId,
    state: container.state,
    statusCode: container.statusCode,
    mediaId: container.mediaId,
})

@Injectable()
/** The Instagram publishing tools for internal callers, run by the account the tool runner handed (never a silent pick). */
export class InstagramNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = INSTAGRAM_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly registry: InstagramPublishRegistryService,
    ) {}

    /** Runs one Instagram tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            switch (tool) {
                case SOCIAL_TOOL_NAME.instagramMediaPublish: {
                    const asked = argumentsOf(tool, INSTAGRAM_MEDIA_PUBLISH_SCHEMA, args)
                    const { connection, port } = await socialAccountOf(this.connections, this.registry, workspaceId, caller)
                    if (asked.containerId !== undefined) return answerOf(await port.release(connection, asked.containerId))
                    return answerOf(
                        await port.publish(connection, {
                            mediaType: asked.mediaType ?? "image",
                            caption: asked.caption ?? null,
                            mediaUrl: asked.mediaUrl ?? null,
                            children: asked.children ?? [],
                            altText: asked.altText ?? null,
                            aiGenerated: asked.aiGenerated ?? null,
                        }),
                    )
                }
                case SOCIAL_TOOL_NAME.instagramMediaStatusGet: {
                    const asked = argumentsOf(tool, INSTAGRAM_MEDIA_STATUS_GET_SCHEMA, args)
                    const { connection, port } = await socialAccountOf(this.connections, this.registry, workspaceId, caller)
                    return answerOf(await port.status(connection, asked.containerId))
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
