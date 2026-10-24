/** A shared window observed independently of the store consuming it. */
export interface RateLimitBucketRow {
    bucket_key: string
    hits: string
    reset_at: Date
    active: boolean
}

/** Effective backend and browser access, including privileges inherited from PUBLIC. */
export interface RateLimitAccessRow {
    anonymous_data: boolean
    authenticated_data: boolean
    anonymous_cleanup: boolean
    authenticated_cleanup: boolean
    backend_cleanup: boolean
    anonymous_consume: boolean
    authenticated_consume: boolean
    backend_consume: boolean
}

/** The updated count returned while acting as the least-privilege backend role. */
export interface RateLimitProofHitsRow {
    hits: string
}

/** Admission returned by the invoker function while acting as the backend role. */
export interface RateLimitProofAllowedRow {
    allowed: boolean
}
