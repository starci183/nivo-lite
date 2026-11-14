import { Injectable } from "@nestjs/common"
import { CONTEXT_NOTICE } from "@modules/domain/context-sources"
import { CustomerMessagesService, type CustomerLine } from "@modules/domain/customer-routes"
import { nativeRefusal } from "@modules/domain/native-tools/native-refusal.policy"
import {
    argumentsOf,
    unknownTool,
    type NativeCaller,
    type NativeToolFamily,
    type ToolJson,
    type ToolManifest,
} from "@modules/domain/tools"
import { InjectClock, type Clock } from "@modules/platform/clock"
import {
    CONVERSATION_MESSAGE_LIST_INPUT_SCHEMA,
    CONVERSATION_MESSAGE_LIST_SCHEMA,
    THREAD_LIST_DEFAULT,
    THREAD_TEXT_MAX,
} from "./customer-message-native.schema"

/** The tool of the connector, by its own name (`nivo.tool.conversation.message.list`). */
export const CONVERSATION_MESSAGE_TOOL = { list: "list" } as const

/** The source name the thread read answers under (the one result shape of a context read). */
export const CONVERSATION_SOURCE = "nivo.conversation"

/** The native connector of the conversation with the customer of a route: the engine's own lines, both directions, read-only. */
export const CONVERSATION_MESSAGE_MANIFEST: ToolManifest = {
    key: "conversation-messages",
    namespace: "nivo.tool.conversation.message",
    name: "Conversation messages",
    contractVersion: "conversation-messages@1",
    tools: [
        {
            name: CONVERSATION_MESSAGE_TOOL.list,
            description:
                "The latest lines of the conversation with the customer this run serves, newest first, both directions: what the customer said and what was told to them (by any agent or a person of the shop, delivered only), with when and who. Takes no conversation id; `since` (ISO) reads only the lines said from then on.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CONVERSATION_MESSAGE_LIST_INPUT_SCHEMA,
            argumentSchema: CONVERSATION_MESSAGE_LIST_SCHEMA,
            secretFields: ["facts"],
        },
    ],
}

/**
 * One line as the model reads it. `role` is the line's direction in the words the thread readers already compare (`user` = the
 * customer, `agent` = the shop: any agent or a person), never read from the text.
 */
const factOf = (line: CustomerLine): ToolJson => ({
    role: line.direction === "from_person" ? "user" : "agent",
    direction: line.direction,
    text: line.text.slice(0, THREAD_TEXT_MAX),
    at: line.saidAt,
    ...(line.files.length === 0
        ? {}
        : {
              files: line.files.map((file) =>
                  file.url === null
                      ? { notKept: file.notKept ?? null, contentType: file.contentType }
                      : { url: file.url, contentType: file.contentType },
              ),
          }),
    agentId: line.agentId,
    memberId: line.memberId,
})

@Injectable()
/**
 * THE thread read of every agent (`nivo.tool.conversation.message.list`, owner ruling R26): the engine's own lines of the run's ROUTE, both
 * directions, newest first, bounded (a limit with a hard cap, a bounded text). What was told counts only once delivered (a claimed,
 * refused or unknown send was not told). Engine data only: no plugin serves it and no chatbot needs to be installed. The route is the
 * caller's (the door fills it from the run token); naming another is refused (`other_conversation`) before anything is read, and a run
 * with no route reads no line.
 */
export class CustomerMessageNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = CONVERSATION_MESSAGE_MANIFEST

    constructor(
        private readonly lines: CustomerMessagesService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Runs the one tool of the connector. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        if (tool !== CONVERSATION_MESSAGE_TOOL.list) throw unknownTool(tool)
        const asked = argumentsOf(tool, CONVERSATION_MESSAGE_LIST_SCHEMA, args)
        const routeId = caller.conversationId
        if (asked.conversationId !== undefined && asked.conversationId !== routeId) throw nativeRefusal("other_conversation")
        const rows =
            routeId === null
                ? []
                : (await this.lines.threadOf(workspaceId, routeId, {
                      limit: asked.limit ?? THREAD_LIST_DEFAULT,
                      told: "delivered",
                      ...(asked.since === undefined ? {} : { since: asked.since }),
                  })).rows
        return { notice: CONTEXT_NOTICE, source: CONVERSATION_SOURCE, asOf: this.clock.now().toISOString(), facts: rows.map((line) => factOf(line)) }
    }
}
