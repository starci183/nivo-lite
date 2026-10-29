/** An indexed document an agent view may read, as the readable-documents query names its columns. */
export interface ReadableSourceProjection {
    /** The source id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The topic, or null. */
    readonly topic: string | null
    /** The kind of source. */
    readonly kind: string
    /** public or internal. */
    readonly visibility: string
    /** The text. */
    readonly content: string | null
    /** The module it is for; null = every module. */
    readonly module: string | null
    /** The instance it is kept for; null = every instance. */
    readonly installationId: string | null
    /** Last change, as the database prints the timestamp. */
    readonly updatedAt: string
}

/** The title a `DELETE ... RETURNING title` answered; undefined when the delete removed nothing. */
export const removedTitle = (raw: unknown): string | undefined => {
    const [row] = Array.isArray(raw)
        ? raw.filter((item): item is object => typeof item === "object" && item !== null)
        : []
    if (row === undefined) return undefined
    const title: unknown = Reflect.get(row, "title")
    return typeof title === "string" ? title : undefined
}
