/** The words and the names the page's data is worded with, resolved once by the connected half (the mapping below it holds no copy). */
export interface SandboxWords {
    /** "Latest request: ...": the values the agent asked for. */
    readonly latest: (values: string) => string
    /** "Next case of renew: INET-2". */
    readonly next: (operation: string, caseId: string) => string
    /** A number as the reader's language writes it ("350.000"). */
    readonly number: (value: number) => string
    /** The moment of a call ("14/11 09:30:12"). */
    readonly time: (iso: string) => string
    /** What a webhook sent in through the page is called in the call log. */
    readonly inbound: string
    /** "Waits for X": what a parked run waits for; "Waiting" when the back end names nothing. */
    readonly waitingWhat: (verbs: string) => string
    readonly waitingWhatAny: string
    /** The agents an account is attached to as one muted line; the words for none when the list is empty. */
    readonly agentsLine: (names: ReadonlyArray<string>) => string
    /** The name suggested for a new account of a provider ("Sandbox iNET"). */
    readonly defaultName: (provider: string) => string
    /** The name the shop gives a provider; the code name when the app has none. */
    readonly providerName: (provider: string) => string
    /** The mark of a provider; null when the app has none. */
    readonly providerLogo: (provider: string) => string | null
}

/** The separator of the parts of one muted line. */
export const SANDBOX_JOIN = " · "
