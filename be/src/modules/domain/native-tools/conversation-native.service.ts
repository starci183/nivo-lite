import { Injectable } from "@nestjs/common"
import { ContextReadsService, THREAD_LINES, boundedLimitOf } from "@modules/domain/context-sources"
import type { LockedSubject } from "@modules/domain/context-sources"
import type { GatewayJson, NativeToolSpec } from "@modules/domain/mcp-gateway"
import { argumentsOf, unknownTool } from "@modules/domain/mcp-gateway"
import { CONVERSATION_MESSAGE_LIST_INPUT_SCHEMA, CONVERSATION_MESSAGE_LIST_SCHEMA } from "./context-native.schema"
import type { ContextAudience } from "@modules/domain/context-sources"

/** The tools of the conversation source, as the `nivo` connector lists them. */
export const CONVERSATION_TOOLS: ReadonlyArray<NativeToolSpec> = [
    {
        name: "conversation.message.list",
        description:
            "The latest lines of the conversation this run serves, newest first: who said what and when. Takes no conversation id.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: CONVERSATION_MESSAGE_LIST_INPUT_SCHEMA,
        argumentSchema: CONVERSATION_MESSAGE_LIST_SCHEMA,
        secretFields: ["notice", "text"],
    },
]

@Injectable()
/**
 * The conversation source of the `nivo` connector: the thread of the conversation the run serves, read for the subject the connector
 * fixed (the run's own conversation, never another). A run with no conversation reads no line.
 */
export class ConversationNativeService {
    readonly tools: ReadonlyArray<NativeToolSpec> = CONVERSATION_TOOLS

    constructor(private readonly reads: ContextReadsService) {}

    /** Runs one tool of the source for the locked subject. */
    async read(
        workspaceId: string,
        tool: string,
        args: GatewayJson,
        subject: LockedSubject,
        _audience: ContextAudience,
    ): Promise<GatewayJson> {
        if (tool !== "conversation.message.list") throw unknownTool(tool)
        const input = argumentsOf(tool, CONVERSATION_MESSAGE_LIST_SCHEMA, args)
        const result = await this.reads.thread(workspaceId, subject, boundedLimitOf(input.limit, THREAD_LINES))
        return { ...result }
    }
}
