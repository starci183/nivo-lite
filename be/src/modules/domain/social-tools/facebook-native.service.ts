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
import { FacebookPublishRegistryService } from "@modules/domain/provider-registry"
import { FACEBOOK_POST_PUBLISH_INPUT_SCHEMA, FACEBOOK_POST_PUBLISH_SCHEMA } from "./facebook-native.schema"
import { socialAccountOf } from "./social-account.policy"
import { socialFailureOf } from "./social-refusal.policy"
import { SOCIAL_TOOL_NAME } from "./social-tools.tool-ids"
import { DomainError } from "@modules/platform/errors"

/**
 * The Facebook DESTINATION tool. Facebook is a domain, not a generic purpose: the contract is Facebook's own (message, link, one photo or
 * video) and no other destination substitutes it, so the tool runner never falls back across destinations; whichever provider account
 * reaches Facebook serves it.
 */
export const FACEBOOK_MANIFEST: ToolManifest = {
    key: "facebook",
    namespace: "nivo.tool",
    name: "Facebook",
    contractVersion: "facebook-native@1",
    timeoutMs: 60_000,
    tools: [
        {
            name: SOCIAL_TOOL_NAME.facebookPostPublish,
            description:
                "Publishes a post to the connected Facebook Page: a text, a link, one photo or one video (by public https address). Answers the post id.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: FACEBOOK_POST_PUBLISH_INPUT_SCHEMA,
            argumentSchema: FACEBOOK_POST_PUBLISH_SCHEMA,
            domain: TOOL.facebookPostPublish,
            internalOnly: true,
        },
    ],
}

@Injectable()
/** The Facebook publishing tool for internal callers, run by the account the tool runner handed (never a silent pick). */
export class FacebookNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = FACEBOOK_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly registry: FacebookPublishRegistryService,
    ) {}

    /** Runs the Facebook tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            if (tool !== SOCIAL_TOOL_NAME.facebookPostPublish) throw unknownTool(tool)
            const asked = argumentsOf(tool, FACEBOOK_POST_PUBLISH_SCHEMA, args)
            const { connection, port } = await socialAccountOf(this.connections, this.registry, workspaceId, caller)
            const post = await port.publish(connection, {
                message: asked.message ?? null,
                link: asked.link ?? null,
                media: asked.media === undefined ? null : { kind: asked.media.kind, url: asked.media.url, title: asked.media.title ?? null },
            })
            return { kind: post.kind, postId: post.postId, mediaId: post.mediaId }
        } catch (cause) {
            const failure = socialFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
