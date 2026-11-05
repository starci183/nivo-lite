/** One device row, already formatted for the person's locale. */
export interface SessionRowView {
    readonly id: string
    /** The device name, or the "unknown device" copy. */
    readonly device: string
    /** The facts line under the name (when it signed in, when it was last active, the address). */
    readonly facts: string
    readonly isCurrent: boolean
    /** A phone or tablet, which draws the phone glyph; any other device draws the desktop one. */
    readonly isPhone: boolean
}

/** One sign-in method and whether the account has it linked. */
export interface MethodView {
    readonly id: string
    readonly label: string
    readonly isLinked: boolean
}

/** What the sign-in card of the account page draws: the address and the methods. */
export interface AccountSignInView {
    readonly email: string
    readonly methods: ReadonlyArray<MethodView>
}
