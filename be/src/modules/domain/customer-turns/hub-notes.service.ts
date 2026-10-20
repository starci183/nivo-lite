import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { HubNote } from "./gateway-turns.contracts"
import { INSERT_HUB_LINE } from "./persistence/gateway-turns.sql"

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

@Injectable()
/**
 * Posts the hotel desk's lines to the Hub as the speaking agent, so the Hub routes each to that agent's home room. This is the small
 * adapter of the Hub card contract v1 (`booking_held`, `handoff_note`, `approval_request`): until the card column lands, the card is
 * written as its one-line body; the approval itself is the work item's own card.
 */
export class HubNotesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Posts one note as an agent of the workspace. */
    async post(note: HubNote, agentId: string, refs: NoteRefs): Promise<void> {
        await this.entityManager.query(INSERT_HUB_LINE, [
            note.workspaceId,
            agentId,
            noteBodyOf(note),
            refs.leadId,
            refs.workItemId,
        ])
    }
}
