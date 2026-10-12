/** One destination in the console rail; `badge` is a real pending count (Office only). */
export type ConsoleNavItem = {
    readonly id: string
    readonly label: string
    readonly href: string
    readonly icon: ConsoleIconName
    /** Rail section the destination belongs to: the daily work, running the business, setting it up. */
    readonly group: "work" | "operate" | "setup"
    readonly isActive: boolean
    readonly badge: number
}

/** The semantic glyph names the console rail uses (the closed set of the icon leaf). */
export type ConsoleIconName =
    | "community"
    | "overview"
    | "account"
    | "review"
    | "email"
    | "brain"
    | "password"
    | "saved"
    | "agentos"
    | "apps"
    | "talents"
    | "servers"
    | "wallet"

/** One approval waiting for a person, as the bell list draws it. */
export type ConsolePending = {
    readonly id: string
    readonly leadName: string
    readonly summary: string
    readonly href: string
}

/** One workspace the signed-in person is an active member of. */
export type ConsoleWorkspace = {
    readonly id: string
    readonly name: string
    readonly role: "owner" | "manager" | "staff"
}
