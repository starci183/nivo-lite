/** One content theme. */
export interface PillarRow {
    /** The theme. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** Whether it is in use. */
    readonly active: boolean
}

/** One channel the workspace posts to. */
export interface CadenceRow {
    /** The channel. */
    readonly channel: string
}

/** One public knowledge source that changed. */
export interface FreshSourceRow {
    /** The source. */
    readonly id: string
    /** Its title. */
    readonly title: string
    /** Its topic, when it has one. */
    readonly topic: string | null
    /** The first 400 characters of its text. */
    readonly excerpt: string
    /** When it changed, as an ISO instant in UTC with microseconds. */
    readonly changed_at: string
}
