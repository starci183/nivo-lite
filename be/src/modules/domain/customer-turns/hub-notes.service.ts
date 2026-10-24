import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { isOfficeRoomKey, OfficeCardsService } from "@modules/domain/messages"
import type { OfficeCardPost } from "@modules/domain/messages"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { HubNote, HubNoteSource } from "./gateway-turns.contracts"

/** What a note line refers to. */
export interface NoteRefs {
    /** The customer, or null. */
    readonly leadId: string | null
    /** The work item, or null. */
    readonly workItemId: string | null
}

/** The card contract's limits (be/src/modules/domain/messages/office-card.policy.ts). */
const MAX_TITLE = 160
const MAX_LABEL = 80
const MAX_VALUE = 400
const MAX_BODY = 4000
const MAX_FIELDS = 12
const MAX_SOURCES = 10
const MAX_KIND = 40
const MAX_REF = 200

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

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

const sourceOf = (source: HubNoteSource): HubNoteSource => ({
    layer: source.layer,
    kind: clip(source.kind, MAX_KIND),
    ref: clip(source.ref, MAX_REF),
    label: clip(source.label, MAX_TITLE),
    ...(source.href === undefined ? {} : { href: source.href }),
})

/** The v1 card payload of a note, kept inside the contract's limits; empty rows, body and sources are left out. */
export const noteCardOf = (note: HubNote): Readonly<Record<string, unknown>> => {
    const fields = note.fields
        .filter((field) => field.label.trim() !== "" && field.value.trim() !== "")
        .slice(0, MAX_FIELDS)
        .map((field) => ({ label: clip(field.label, MAX_LABEL), value: clip(field.value, MAX_VALUE) }))
    const body = note.body?.trim() ?? ""
    const sources = (note.sources ?? []).slice(0, MAX_SOURCES).map(sourceOf)
    return {
        v: 1,
        type: note.type,
        title: clip(note.title, MAX_TITLE),
        ...(fields.length === 0 ? {} : { fields }),
        ...(body === "" ? {} : { body: clip(body, MAX_BODY) }),
        ...(sources.length === 0 ? {} : { sources }),
    }
}

@Injectable()
/**
 * Posts the result cards of a customer turn to the Hub as the speaking agent (Hub card contract v1), in the note's room when it
 * names one, else routed by the database to the agent's home room. The card's one-line body stays the preview; its sources are only
 * what the turn actually used.
 */
export class HubNotesService {
    constructor(
        private readonly cards: OfficeCardsService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    /** Posts one note as an agent of the workspace. */
    async post(note: HubNote, agentId: string, refs: NoteRefs): Promise<void> {
        await this.cards.post({ workspaceId: note.workspaceId }, this.lineOf(note, agentId, refs))
    }

    /** Posts a retried operation's note once, with the inbox claim and card in the same transaction. */
    async postOnce(note: HubNote, agentId: string, refs: NoteRefs, key: string): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim("hub.note", JSON.stringify([note.workspaceId, key]), manager))) return
            await this.cards.post({ workspaceId: note.workspaceId }, this.lineOf(note, agentId, refs), manager)
        })
    }

    private lineOf(note: HubNote, agentId: string, refs: NoteRefs): OfficeCardPost {
        return {
            room: isOfficeRoomKey(note.room) ? note.room : null,
            agentId,
            authorName: note.authorName,
            body: noteBodyOf(note),
            leadId: refs.leadId,
            workItemId: refs.workItemId,
            card: noteCardOf(note),
        }
    }
}
