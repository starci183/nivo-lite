import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    argumentsOf,
    unknownTool,
    type NativeCaller,
    type NativeToolFamily,
    type ToolJson,
    type ToolManifest,
} from "@modules/domain/tools"
import type { VideoComposePort } from "./video-compose.contracts"
import { VideoComposeRegistryService } from "./video-compose-registry.service"
import { composeFailureOf, composeRefusal } from "./video-compose-refusal.policy"
import { composeSpecProblems } from "./video-compose-spec.policy"
import {
    VIDEO_COMPOSE_INPUT_SCHEMA,
    VIDEO_COMPOSE_SCHEMA,
    VIDEO_RENDER_GET_INPUT_SCHEMA,
    VIDEO_RENDER_GET_SCHEMA,
} from "./video-compose.schema"
import { renderCallbackOf } from "./video-render-callback.policy"
import { DomainError } from "@modules/platform/errors"

/** The tool names inside the family (the full id is `nivo.tool.<name>`). */
export const VIDEO_COMPOSE_TOOL = {
    compose: "video.compose",
    renderGet: "video.render.get",
} as const

/** The full ids the two tools play for the node tool door (`ManifestTool.domain`): the SDK's names. */
const VIDEO_COMPOSE_DOMAIN = {
    compose: TOOL.videoCompose,
    renderGet: TOOL.videoRenderGet,
} as const

/** The generic compose purposes: named by what they do, never by the provider that renders. */
export const VIDEO_COMPOSE_MANIFEST: ToolManifest = {
    key: "video-compose",
    namespace: "nivo.tool",
    name: "Video compose",
    contractVersion: "video-compose@1",
    timeoutMs: 60_000,
    tools: [
        {
            name: VIDEO_COMPOSE_TOOL.compose,
            description:
                "Starts composing one video in the connected compose service from a neutral spec (clips in order, voice and music under them, a logo, captions, aspect, resolution); every file is a signed https address of the file store. Answers `{ renderId, provider }` at once; the finished render comes as `nivo.trigger.video.render.completed` (or read it with `nivo.tool.video.render.get`).",
            scope: "write",
            defaultMode: "ask",
            inputSchema: VIDEO_COMPOSE_INPUT_SCHEMA,
            argumentSchema: VIDEO_COMPOSE_SCHEMA,
            domain: VIDEO_COMPOSE_DOMAIN.compose,
            internalOnly: true,
        },
        {
            name: VIDEO_COMPOSE_TOOL.renderGet,
            description:
                "Where a render stands (queued, rendering, done, failed); once done, the https address of the video (the provider keeps it a limited time: store it with `nivo.tool.file.put`).",
            scope: "read",
            defaultMode: "auto",
            inputSchema: VIDEO_RENDER_GET_INPUT_SCHEMA,
            argumentSchema: VIDEO_RENDER_GET_SCHEMA,
            domain: VIDEO_COMPOSE_DOMAIN.renderGet,
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * The generic compose tools for internal callers: each call runs on the ONE account the tool runner handed it (`caller.connectionId`:
 * the node's providers are ordered alternatives, the runner's fallback goes on to the next account on a failure proved `not_sent`),
 * through the port its provider registered; a call with no account handed, or an account whose provider composes nothing, is
 * `not_connected`. The spec's cross-member rules are checked before any provider is asked (`invalid_spec`). The provider is told
 * where to call back (`renderCallbackOf`, the connection's webhook secret last); NIVO never fetches a `fileUrl`. A provider's refusal is answered as the tool's own.
 */
export class VideoComposeNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = VIDEO_COMPOSE_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly registry: VideoComposeRegistryService,
    ) {}

    /** Runs one compose tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            return await this.run(workspaceId, tool, args, caller)
        } catch (cause) {
            const failure = composeFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private async run(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        switch (tool) {
            case VIDEO_COMPOSE_TOOL.compose: {
                const { spec } = argumentsOf(tool, VIDEO_COMPOSE_SCHEMA, args)
                const problems = composeSpecProblems(spec)
                if (problems.length > 0) throw composeRefusal("invalid_spec", problems.join("; "))
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const secret = port.webhook === null ? null : await this.connections.readSecret(connection.id)
                const callback = renderCallbackOf({
                    origin: this.connections.publicOrigin(),
                    provider: port.provider,
                    webhook: port.webhook,
                    connectionId: connection.id,
                    webhookSecret: secret?.webhookSecret ?? null,
                })
                const started = await port.start(connection, spec, callback)
                return { renderId: started.renderId, provider: port.provider }
            }
            case VIDEO_COMPOSE_TOOL.renderGet: {
                const { renderId } = argumentsOf(tool, VIDEO_RENDER_GET_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const state = await port.statusOf(connection, renderId)
                return {
                    renderId: state.renderId,
                    status: state.status,
                    outputUrl: state.outputUrl ?? null,
                    error: state.error ?? null,
                    provider: port.provider,
                }
            }
            default:
                throw unknownTool(tool)
        }
    }

    /** The account the tool runner handed and its provider's compose port; anything else is `not_connected`. */
    private async accountOf(
        workspaceId: string,
        caller: NativeCaller,
    ): Promise<{ readonly connection: ConnectionRecord; readonly port: VideoComposePort }> {
        if (caller.connectionId === undefined) throw composeRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : this.registry.of(connection.provider)
        if (connection === null || port === undefined) throw composeRefusal("not_connected")
        return { connection, port }
    }
}
