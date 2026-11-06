/** The record a run is about. */
export interface RunSubject {
    /** The kind of the record, for instance `sales.order`. */
    readonly kind: string
    /** The id of the record. */
    readonly id: string
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A subject `{ kind, id }` of two non-empty texts, as the graph host reads a trigger's subject; null for anything else. */
const subjectIn = (value: unknown): RunSubject | null => {
    const subject = isObject(value) ? value["subject"] : undefined
    if (!isObject(subject)) return null
    const { kind, id } = subject
    return typeof kind === "string" && kind !== "" && typeof id === "string" && id !== "" ? { kind, id } : null
}

/**
 * The subject of a run. The graph host writes the trigger, with its subject, into the input of the run's first step (`input.trigger`), and
 * it is the turn's subject from there; the run's own `context` is the wake's. The step's trigger leads, the context follows, and a run that
 * names none is about nothing in particular (the host's resolvers find a subject at run time and do not store it on the run).
 */
export const subjectOfRun = (stepInput: unknown, context: unknown): RunSubject | null => {
    const trigger = isObject(stepInput) ? stepInput["trigger"] : undefined
    return subjectIn(trigger) ?? subjectIn(context)
}
