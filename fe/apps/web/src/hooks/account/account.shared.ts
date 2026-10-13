/** The shortest display name an account may carry. */
export const NAME_MIN = 2

/** The shortest password an account may set. */
export const PASSWORD_MIN = 8

/** One device row, already formatted for the person's locale. */
export interface SessionRowView {
    readonly id: string
    /** The device name, or the "unknown device" copy. */
    readonly device: string
    /** The facts line under the name (address, when it signed in, when it was last active). */
    readonly facts: string
    readonly isCurrent: boolean
}
