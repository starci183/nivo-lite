/** One device row, already formatted for the person's locale. */
export interface SessionRowView {
    readonly id: string
    /** The device name, or the "unknown device" copy. */
    readonly device: string
    /** The facts line under the name (address, when it signed in, when it was last active). */
    readonly facts: string
    readonly isCurrent: boolean
}

/** One sign-in method and whether the account has it linked. */
export interface MethodView {
    readonly id: string
    readonly label: string
    readonly isLinked: boolean
}
