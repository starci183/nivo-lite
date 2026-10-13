/** The ids port: business code asks it for a new id instead of minting one from the ambient random source, so a spec can name every id. */
export interface Ids {
    /** A new unique id (a UUID). */
    next(): string
}
