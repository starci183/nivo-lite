/** One remembered SePay delivery as the database answers it. */
export interface SepayEventRow {
    /** The row id. */
    readonly id: string
    /** When it arrived, ISO text. */
    readonly at: string
    /** `accepted`, `duplicate` or `unauthorized`. */
    readonly outcome: string
    /** `credit`, `debit` or `ping`. */
    readonly kind: string
    /** The amount in VND; null for a ping or a refused key. */
    readonly amount_vnd: string | null
    /** The SePay transaction id; null when none. */
    readonly provider_event_id: string | null
    /** `test` or `live`. */
    readonly environment: string
}

/** The health counters of one SePay connection as the database answers them. */
export interface SepayStatsRow {
    /** When the last delivery arrived (any outcome), ISO text. */
    readonly last_at: string | null
    /** When the last SePay ping arrived, ISO text. */
    readonly ping_at: string | null
    /** When the last transaction arrived, ISO text. */
    readonly transaction_at: string | null
    /** Deliveries in the last 24 hours. */
    readonly total_24h: string
    /** Deliveries in the last 24 hours whose API key was valid. */
    readonly valid_24h: string
    /** Repeated deliveries in the last 24 hours. */
    readonly duplicate_24h: string
}
