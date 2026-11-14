import { Injectable, Optional } from "@nestjs/common"
import { NodeRightsSwitchService } from "@modules/domain/tool-grants"
import { TeamChatCardsService, type PersonLineHeard } from "@modules/domain/team-chat"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { UnroutedTurn } from "./team-chat-turns.contracts"
import { TeamChatTurnsLogEvent } from "./team-chat-turns.log-events"
import { unhandledKeyOf, unhandledLineOf, unhandledMessageOf } from "./team-chat-turns.policy"

/** The language of the line NIVO writes: the team chat keeps none per room, the shop speaks Vietnamese. */
const TEAM_LOCALE = "vi"

@Injectable()
/**
 * The old tag path of the team chat, kept shut while a workspace's switch "node rights decide" is ON: a message in /chat may then
 * only run the module's own chat workflow, so an agent the message names whose chat turn did not start gets no UNPINNED tag (which
 * the agent's own graph, or a workflow woken by a person's tag, would answer). For those agents NIVO writes one line under the
 * message saying nothing ran; nobody answers in the agent's place. With the switch off, or in an app without the switch, the path
 * is open and nothing is written.
 */
export class ChatFallbackService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly nodeSwitch?: NodeRightsSwitchService,
        @Optional() private readonly cards?: TeamChatCardsService,
    ) {}

    /** True while the old tag path is shut for the workspace: its node rights decide. */
    async closed(workspaceId: string): Promise<boolean> {
        return (await this.nodeSwitch?.decides(workspaceId)) === true
    }

    /**
     * The agents the old tag path must skip for a message of a workspace whose path is shut: the ones whose turn the router took and
     * the ones whose turn did not start. For the latter NIVO writes one line under the message (once per message, never as an
     * agent); a line that cannot be written is logged and the path stays shut.
     */
    async shut(
        line: PersonLineHeard,
        taken: ReadonlyArray<string>,
        unrouted: ReadonlyArray<UnroutedTurn>,
    ): Promise<ReadonlyArray<string>> {
        if (unrouted.length === 0) return taken
        this.logger.warn(TeamChatTurnsLogEvent.FallbackClosed, {
            roomId: line.room.id,
            count: unrouted.length,
            codes: [...new Set(unrouted.map((turn) => turn.code))],
        })
        const words = unhandledLineOf(TEAM_LOCALE)
        try {
            await this.cards?.postMessage(line.workspaceId, {
                authorAgentId: null,
                roomId: line.room.id,
                toUserId: null,
                body: words.text,
                key: unhandledKeyOf(line.message.id),
                agentMessage: unhandledMessageOf(words, unrouted),
                replyTo: line.message.id,
            })
        } catch (cause) {
            this.logger.error(TeamChatTurnsLogEvent.UnhandledNotPosted, cause, { roomId: line.room.id })
        }
        return [...taken, ...unrouted.map((turn) => turn.agentId)]
    }
}
