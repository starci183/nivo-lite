import { Injectable } from "@nestjs/common"
import { lineClientIdOf, TeamChatRoomsService } from "@modules/domain/team-chat"
import type { HubNote, HubNoteSource } from "./gateway-turns.contracts"

/** What a note line refers to. */
export interface NoteRefs {
    /** The customer, or null. */
    readonly leadId: string | null
    /** The work item, or null. */
    readonly workItemId: string | null
}

/** The one-line body of a note: the title and its fields. */
export const noteBodyOf = (note: HubNote): string =>
    [note.title, ...note.fields.map((field) => `${field.label}: ${field.value}`)].join(" · ")

/** The layer-1 sources of the connector tools a turn called, once each, in call order. */
export const toolSourcesOf = (tools: ReadonlyArray<string>): ReadonlyArray<HubNoteSource> =>
    [...new Set(tools)].map((tool): HubNoteSource => ({
        layer: 1,
        kind: "mcp_tool",
        ref: tool,
        label: tool,
    }))

@Injectable()
/**
 * Says the result of a customer turn to the owner as the speaking agent, in their direct room (the team chat has text lines only: the
 * one-line body is the title and its fields). The note's department room key is not a room: it is ignored. A retried note is the same
 * line, because its key is the line's key.
 */
export class HubNotesService {
    constructor(private readonly chat: TeamChatRoomsService) {}

    /** Says one note as an agent of the workspace; nothing happens when the agent is not of the workspace. */
    async post(note: HubNote, agentId: string, _refs: NoteRefs): Promise<void> {
        await this.say(note, agentId, null)
    }

    /** Says a retried operation's note once: the same key is the same line. */
    async postOnce(note: HubNote, agentId: string, _refs: NoteRefs, key: string): Promise<void> {
        await this.say(note, agentId, lineClientIdOf(`hub.note:${key}`))
    }

    private async say(note: HubNote, agentId: string, key: string | null): Promise<void> {
        await this.chat.postAsAgent(note.workspaceId, { agent: agentId, toUserId: null, body: noteBodyOf(note), key })
    }
}
