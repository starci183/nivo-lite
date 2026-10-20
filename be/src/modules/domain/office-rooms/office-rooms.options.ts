/** What the office rooms capability needs from the composition root: nothing besides the workspace members it reads. */
export interface OfficeRoomsOptions {
    /** Registers the capability for every module of the app. */
    readonly isGlobal?: boolean
}
