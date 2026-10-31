import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type {
    AgentHandlerEnding,
    AgentTurnPrep,
    AgentTurnView,
    AgentWakeSource,
    AgentWakeView,
    AgentWorkHandler,
} from "@modules/domain/agent-work"
import {
    InternalProposalSettlerService,
    InternalTurnContextService,
    RuntimeAgentService,
    internalTimeoutMsOf,
} from "@modules/domain/agent-turns"
import type { InternalActionResult } from "@modules/domain/agent-turns"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentHeader } from "@modules/domain/agents"
import { ChatTypingService } from "@modules/domain/chat-typing"
import { InstallationDirectoryService } from "@modules/domain/modules"
import { MessagesReadService, OfficeLinesService } from "@modules/domain/messages"
import { ThreadTagHandlerService } from "@modules/domain/thread-work"
import { WorkspaceMemberDirectoryService, isManagerRole } from "@modules/domain/workspace-members"
import { threadKeyFor } from "@modules/integrations/openclaw"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    TagLineKey,
    TagSpeaker,
    TagSurface,
    TagTalk,
    TagVoice,
    TranscriptLine,
} from "./office-command-candidates.contracts"
import { OfficeCommandCandidatesLogEvent } from "./office-command-candidates.log-events"
import { holdLineKeyOf, isHeldReason, TRANSCRIPT_SIZE, transcriptOf } from "./office-tag.policy"
import { OfficeCommandService } from "./office-command.service"

/** The language of a tag wake that did not carry one. */
const DEFAULT_LOCALE: Locale = "vi"

/** The first work item the turn's actions opened, which the Work tab links to the run's trace; null when it opened none. */
const firstWorkItemOf = (actions: ReadonlyArray<InternalActionResult>): string | null => {
    for (const action of actions) {
        if (action.outcome === "requested") return action.workItemId
    }
    return null
}

const endOf = (
    status: AgentHandlerEnding["status"],
    reason: string | null,
    outcome: unknown = null,
): AgentHandlerEnding => ({ status, reason, outcome })

@Injectable()
/**
 * The business of a tag wake. A colleague tagged the agent in the Office or in a work thread: the command card is tried first when an
 * owner or manager wrote it in the Office, the context is built from the talk, and the answer goes back where the tag was written. A
 * tag the agent cannot take (not applied, paused, over quota, switched off) is one note and an ending, never a silent skip.
 */
export class OfficeTagHandlerService implements AgentWorkHandler, OnModuleInit, TagSurface {
    /** The one wake source this handler answers. */
    readonly sources: ReadonlyArray<AgentWakeSource> = ["tag"]

    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly handlers: AgentWorkHandlersService,
        private readonly context: InternalTurnContextService,
        private readonly settler: InternalProposalSettlerService,
        private readonly runtime: RuntimeAgentService,
        private readonly agents: AgentDirectoryService,
        private readonly installations: InstallationDirectoryService,
        private readonly members: WorkspaceMemberDirectoryService,
        private readonly commands: OfficeCommandService,
        private readonly reader: MessagesReadService,
        private readonly lines: OfficeLinesService,
        private readonly typing: ChatTypingService,
        private readonly threads: ThreadTagHandlerService,
    ) {}

    /** Takes the tag source of the drain. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Ends the wake without a model when the agent cannot take it or a command card answered; otherwise builds the turn. */
    async prepare(turn: AgentTurnView): Promise<AgentTurnPrep> {
        const agent = await this.agents.headOf(turn.workspaceId, turn.agentId)
        if (agent === null) return { kind: "end", ending: endOf("skipped", "agent_gone") }
        if (agent.status !== "active") return this.refuse(turn, agent, "office.tagPaused", "agent_paused")
        const installation = await this.installations.ofAgent(turn.workspaceId, turn.agentId)
        if (installation !== null && installation.activeContextVersionId === null) {
            return this.refuse(turn, agent, "office.tagNotApplied", "not_applied")
        }
        const surface = this.surfaceOf(turn)
        const talk = await surface.talkOf(turn)
        if (talk === undefined) return { kind: "end", ending: endOf("skipped", "message_gone") }
        const answered = await this.commandCardOf(turn)
        if (answered !== null) return { kind: "end", ending: endOf("done", null, { command: answered }) }
        const runtimeAgentId = await this.runtime.agentFor(turn.workspaceId, agent.module, installation)
        const message = await this.context.messageOf({
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            source: "tag",
            locale: this.localeOf(turn),
            text: transcriptOf(talk.before, talk.tagged),
        })
        await this.show(turn, agent, true)
        return {
            kind: "run",
            plan: {
                module: agent.module,
                runtimeAgentId,
                threadKey: threadKeyFor(runtimeAgentId, surface.sessionOf(turn)),
                message,
                timeoutMs: internalTimeoutMsOf("tag"),
            },
        }
    }

    /** Applies what the model proposed and says its reply where the tag was written, once per wake. */
    async settle(turn: AgentTurnView, proposal: unknown): Promise<AgentHandlerEnding> {
        const agent = await this.agents.headOf(turn.workspaceId, turn.agentId)
        if (agent === null) return endOf("skipped", "agent_gone")
        try {
            const installation = await this.installations.ofAgent(turn.workspaceId, turn.agentId)
            const settled = await this.settler.settle(turn, proposal, {
                module: agent.module,
                actorName: await this.actorNameOf(turn, agent),
                locale: this.localeOf(turn),
                installationId: installation?.id ?? null,
            })
            if (settled.kind === "stale") return endOf("held", "stale")
            if (settled.reply !== "") await this.surfaceOf(turn).say(turn, agent, settled.reply, "agent")
            return endOf("done", null, {
                replied: settled.reply !== "",
                tasks: settled.tasks,
                actions: settled.actions.length,
                needsHuman: settled.needsHuman,
                workItemId: firstWorkItemOf(settled.actions),
            })
        } finally {
            await this.show(turn, agent, false)
        }
    }

    /** Answers a tag no turn can take with a note, and ends the wake: held while work is off, skipped otherwise. */
    async holdOver(turn: AgentWakeView, reason: string): Promise<AgentHandlerEnding> {
        const agent = await this.agents.headOf(turn.workspaceId, turn.agentId)
        if (agent === null) return endOf("skipped", "agent_gone")
        await this.show(turn, agent, false)
        await this.note(turn, agent, holdLineKeyOf(reason))
        return endOf(isHeldReason(reason) ? "held" : "skipped", reason)
    }

    /** The Office half of the surface: the talk of the room up to the tagging line. */
    async talkOf(turn: AgentTurnView): Promise<TagTalk | undefined> {
        const messageId = turn.context.messageId
        if (messageId === undefined) return undefined
        const room = turn.context.room ?? null
        const page = await this.reader.page(turn.workspaceId, {
            room,
            before: null,
            size: TRANSCRIPT_SIZE + 1,
        })
        const talk = page
            .filter((line) => line.author_kind !== "system" && line.room === room)
            .map((line) => ({ id: line.id, author: line.author_name, body: line.body }))
            .reverse()
        const tagged = talk.find((line) => line.id === messageId) ?? (await this.taggedLine(turn, messageId))
        return tagged === undefined ? undefined : { before: talk, tagged }
    }

    /** One session per room, so a room's talk stays in one conversation of the runtime. */
    sessionOf(turn: AgentTurnView): string {
        return `office:${turn.context.room ?? "main"}`
    }

    /** Says it in the room, as the agent or as NIVO, unless the same words were already said since the wake. */
    async say(turn: AgentWakeView, speaker: TagSpeaker, text: string, voice: TagVoice): Promise<void> {
        await this.lines.post(
            { workspaceId: turn.workspaceId },
            {
                body: text,
                lead_id: null,
                work_item_id: null,
                room: turn.context.room ?? null,
                unlessSaidSince: turn.wakeCreatedAt,
                ...(voice === "agent" ? { agent_id: speaker.id } : {}),
            },
        )
    }

    private async taggedLine(turn: AgentTurnView, messageId: string): Promise<TranscriptLine | undefined> {
        const text = await this.reader.textOf(turn.workspaceId, messageId)
        return text === undefined ? undefined : { id: messageId, author: "", body: text.body }
    }

    private surfaceOf(turn: AgentWakeView): TagSurface {
        return turn.context.threadId === undefined ? this : this.threads
    }

    private localeOf(turn: AgentWakeView): Locale {
        return turn.context.locale ?? DEFAULT_LOCALE
    }

    /** The command card of the message when an owner or manager wrote it in the Office; null when the message is for a chat turn. */
    private async commandCardOf(turn: AgentTurnView): Promise<"card" | "reply" | null> {
        const { authorUserId, messageId, threadId } = turn.context
        if (threadId !== undefined || authorUserId === undefined || messageId === undefined) return null
        const member =
            turn.actorMemberId === null ? null : await this.members.find(turn.workspaceId, turn.actorMemberId)
        if (member === null || !isManagerRole(member.role)) return null
        const outcome = await this.commands.propose(authorUserId, turn.workspaceId, {
            messageId,
            locale: this.localeOf(turn),
        })
        return outcome.kind === "chat" ? null : outcome.kind
    }

    private async refuse(
        turn: AgentWakeView,
        agent: AgentHeader,
        key: TagLineKey,
        reason: string,
    ): Promise<AgentTurnPrep> {
        await this.note(turn, agent, key)
        return { kind: "end", ending: endOf("skipped", reason) }
    }

    private note(turn: AgentWakeView, agent: AgentHeader, key: TagLineKey): Promise<void> {
        const text = this.catalog.get(key, { handle: agent.handle }, this.localeOf(turn))
        return this.surfaceOf(turn).say(turn, agent, text, "nivo")
    }

    private async actorNameOf(turn: AgentTurnView, agent: AgentHeader): Promise<string> {
        const member =
            turn.actorMemberId === null ? null : await this.members.find(turn.workspaceId, turn.actorMemberId)
        return member === null ? agent.name : member.displayName
    }

    /** Shows the room that the agent is working, or clears it; a hint that fails never fails the turn. */
    private async show(turn: AgentWakeView, agent: AgentHeader, working: boolean): Promise<void> {
        if (turn.context.threadId !== undefined) return
        try {
            await this.typing.setAgent(
                turn.workspaceId,
                { room: turn.context.room ?? null, conversationId: null },
                agent,
                working,
            )
        } catch (cause) {
            this.logger.error(OfficeCommandCandidatesLogEvent.TypingFailed, cause, { agentId: turn.agentId })
        }
    }
}
