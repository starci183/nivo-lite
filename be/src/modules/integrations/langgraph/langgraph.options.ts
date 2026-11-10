/** What the LangGraph integration needs: two bounds. It reads no address and no secret. */
export interface LanggraphOptions {
    /** The most compiled graphs kept in memory (one per workflow version); the one used longest ago leaves first. */
    readonly compiledMax: number
    /** The most nodes one call may run before the library stops it: the bound of a graph that loops without end. */
    readonly stepLimit: number
}
