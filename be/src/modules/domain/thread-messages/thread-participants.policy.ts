import type { MentionView } from "./thread-messages.contracts"

/** The part of a stored message that says who took part: who wrote it and whom it tagged. */
export interface ParticipantRow {
    /** member or agent. */
    readonly author_kind: string
    /** The author's id. */
    readonly author_id: string
    /** The tags the author chose. */
    readonly mentions: ReadonlyArray<Pick<MentionView, "kind" | "id">>
}

/** How many distinct people and agents took part in a thread. */
export interface ThreadParticipants {
    /** Distinct members who wrote or were tagged. */
    readonly people: number
    /** Distinct agents who wrote or were tagged. */
    readonly agents: number
}

/** Counts the distinct members and agents that wrote or were tagged in the messages; a group tag names nobody. */
export const participantsOf = (rows: ReadonlyArray<ParticipantRow>): ThreadParticipants => {
    const people = new Set<string>()
    const agents = new Set<string>()
    const add = (kind: string, id: string): void => {
        if (kind === "member") people.add(id)
        else if (kind === "agent") agents.add(id)
    }
    for (const row of rows) {
        add(row.author_kind, row.author_id)
        for (const mention of row.mentions) add(mention.kind, mention.id)
    }
    return { people: people.size, agents: agents.size }
}
