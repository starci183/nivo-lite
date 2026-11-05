import type { EntityDefinition, SequenceDate } from "@nivo-lite/agent-sdk/entity"
import type { SortDirection } from "@nivo-lite/agent-sdk/query"

/** The entity declarations the compiler resolves names against, by entity name. */
export type EntityCatalog = ReadonlyMap<string, EntityDefinition>

/** The ordered fields a keyset compares, in order. */
export type KeysetOrder = ReadonlyArray<readonly [string, SortDirection]>

/** The pure sequence functions of `@nivo-lite/agent-sdk/entity` (`sequencePeriodOf`, `formatSequence`), injected so the compiler holds no runtime dependency on the package. */
export interface SequenceTools {
    /** The period key a counter belongs to: empty when it never restarts. */
    period(resets: "day" | "month" | "year" | undefined, date: SequenceDate): string
    /** The display value of counter `n`. */
    format(format: string, n: number, date: SequenceDate): string
}

/** What an insert needs from the runtime: the time, fresh ids, the workspace calendar day and the sequence functions. */
export interface InsertStamp {
    /** The transaction time, ISO text (the `now` default). */
    readonly now: string
    /** Mints a fresh uuid (the `uuid` default). */
    readonly newId: () => string
    /** The calendar day in the workspace time zone (sequence periods and formats). */
    readonly date: SequenceDate
    /** The sequence functions. */
    readonly sequences: SequenceTools
}
