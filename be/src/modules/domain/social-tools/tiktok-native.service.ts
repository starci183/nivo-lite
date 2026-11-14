import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { TiktokPublishRegistryService, type TiktokPublishPort } from "@modules/domain/provider-registry"
import { socialFailureOf, socialRefusal } from "./social-refusal.policy"
import {
    TIKTOK_CREATOR_INFO_GET_INPUT_SCHEMA,
    TIKTOK_CREATOR_INFO_GET_SCHEMA,
    TIKTOK_VIDEO_PUBLISH_INPUT_SCHEMA,
    TIKTOK_VIDEO_PUBLISH_SCHEMA,
    TIKTOK_VIDEO_STATUS_GET_INPUT_SCHEMA,
    TIKTOK_VIDEO_STATUS_GET_SCHEMA,
} from "./tiktok-native.schema"
import { DomainError } from "@modules/platform/errors"

/** The tool names inside the connector (the full id is `nivo.tool.<name>`). */
export const TIKTOK_TOOL = {
    videoPublish: "tiktok.video.publish",
    videoStatusGet: "tiktok.video.status.get",
    creatorInfoGet: "tiktok.creator.info.get",
} as const

/**
 * The TikTok DESTINATION tools. TikTok is a domain, not a generic purpose: its contract is its own (privacy level, duet / stitch /
 * comment switches, cover frame) and no other destination substitutes it, so the tool runner never falls back across destinations.
 */
export const TIKTOK_MANIFEST: ToolManifest = {
    key: "tiktok",
    namespace: "nivo.tool",
    name: "TikTok",
    contractVersion: "tiktok-native@1",
    timeoutMs: 120_000,
    tools: [
        {
            name: TIKTOK_TOOL.videoPublish,
            description:
                "Publishes a video to the connected TikTok account from an https address (direct post). Answers the publish id: poll it with `nivo.tool.tiktok.video.status.get`.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: TIKTOK_VIDEO_PUBLISH_INPUT_SCHEMA,
            argumentSchema: TIKTOK_VIDEO_PUBLISH_SCHEMA,
            domain: TOOL.tiktokVideoPublish,
            internalOnly: true,
        },
        {
            name: TIKTOK_TOOL.videoStatusGet,
            description:
                "Where a TikTok post stands (pending, published, failed with TikTok's reason); once published and moderated, the public post ids.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: TIKTOK_VIDEO_STATUS_GET_INPUT_SCHEMA,
            argumentSchema: TIKTOK_VIDEO_STATUS_GET_SCHEMA,
            domain: TOOL.tiktokVideoStatusGet,
            internalOnly: true,
        },
        {
            name: TIKTOK_TOOL.creatorInfoGet,
            description:
                "What the connected TikTok account may post with: its privacy level options, the duet / stitch / comment limits and the longest video.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: TIKTOK_CREATOR_INFO_GET_INPUT_SCHEMA,
            argumentSchema: TIKTOK_CREATOR_INFO_GET_SCHEMA,
            domain: TOOL.tiktokCreatorInfoGet,
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * The TikTok destination tools for internal callers, run by the TikTok account the tool runner handed the call (never a silent pick: a
 * call with no account handed, or an account of a provider that does not reach TikTok, is refused `not_connected`). A provider's
 * refusal is answered as the tool's own (`socialFailureOf`); any other failure is thrown as it is, with what it proves.
 */
export class TiktokNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = TIKTOK_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly tiktok: TiktokPublishRegistryService,
    ) {}

    /** Runs one TikTok tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            return await this.run(workspaceId, tool, args, caller)
        } catch (cause) {
            const failure = socialFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private async run(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        switch (tool) {
            case TIKTOK_TOOL.videoPublish: {
                const asked = argumentsOf(tool, TIKTOK_VIDEO_PUBLISH_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const started = await port.publish(connection, {
                    source: { kind: "url", videoUrl: asked.videoUrl },
                    privacyLevel: asked.privacyLevel,
                    title: asked.title ?? null,
                    disableDuet: asked.disableDuet ?? null,
                    disableStitch: asked.disableStitch ?? null,
                    disableComment: asked.disableComment ?? null,
                    coverTimestampMs: asked.coverTimestampMs ?? null,
                    brandContentToggle: asked.brandContentToggle ?? null,
                    brandOrganicToggle: asked.brandOrganicToggle ?? null,
                    isAigc: asked.isAigc ?? null,
                })
                return { publishId: started.publishId }
            }
            case TIKTOK_TOOL.videoStatusGet: {
                const { publishId } = argumentsOf(tool, TIKTOK_VIDEO_STATUS_GET_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const status = await port.status(connection, publishId)
                return {
                    publishId: status.publishId,
                    state: status.state,
                    providerStatus: status.providerStatus,
                    failReason: status.failReason,
                    postIds: [...status.postIds],
                }
            }
            case TIKTOK_TOOL.creatorInfoGet: {
                argumentsOf(tool, TIKTOK_CREATOR_INFO_GET_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const creator = await port.creator(connection)
                return { ...creator, privacyLevelOptions: [...creator.privacyLevelOptions] }
            }
            default:
                throw unknownTool(tool)
        }
    }

    /** The account the tool runner handed and its provider's TikTok port: none handed, another workspace's, or a provider that reaches no TikTok is `not_connected`. */
    private async accountOf(
        workspaceId: string,
        caller: NativeCaller,
    ): Promise<{ readonly connection: ConnectionRecord; readonly port: TiktokPublishPort }> {
        if (caller.connectionId === undefined) throw socialRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : this.tiktok.of(connection.provider)
        if (connection === null || port === undefined) throw socialRefusal("not_connected")
        return { connection, port }
    }
}
