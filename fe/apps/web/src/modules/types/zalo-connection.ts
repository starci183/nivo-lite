/** The tabs of the page of one Zalo OA connection, in the order the owner approved. */
export const ZALO_TABS = ["overview", "setup", "check", "agents"] as const

/** One tab of the page. */
export type ZaloTab = (typeof ZALO_TABS)[number]

/** The tone of a status mark. */
export type ZaloTone = "success" | "danger" | "warning" | "neutral"

/** The header of the page: the OA, its status and the words the banner says. */
export interface ZaloHeadView {
    readonly name: string
    readonly chipLabel: string
    readonly chipTone: ZaloTone
    readonly facts: string
    /** Why the OA cannot send; empty when it can. */
    readonly banner: string
}

/** One row of the check list. */
export interface ZaloCheckLineView {
    readonly key: string
    readonly mark: "ok" | "fail" | "warn"
    readonly title: string
    readonly detail: string
    /** The row offers the check again. */
    readonly canRecheck: boolean
}

/** A follower the test message can go to. */
export interface ZaloRecipientOption {
    readonly id: string
    readonly label: string
}

/** The test send: who can receive it and, when it is closed, why. */
export interface ZaloSendView {
    readonly options: ReadonlyArray<ZaloRecipientOption>
    /** Why the send is closed; empty when it is open. */
    readonly blocked: string
}

/** One labelled fact of the overview or the setup tab. */
export interface ZaloFactView {
    readonly id: string
    readonly label: string
    readonly value: string
}

/** The two addresses the owner pastes into Zalo. */
export interface ZaloPasteView {
    readonly callbackUrl: string
    readonly webhookUrl: string
}

/** One agent of the workspace and whether it works through the connection. */
export interface ZaloAgentRowView {
    readonly id: string
    readonly name: string
    readonly isOn: boolean
}

/** One line of the live panel. */
export interface ZaloEventLineView {
    readonly id: string
    readonly title: string
    readonly outcomeLabel: string
    readonly outcomeTone: ZaloTone
    readonly detail: string
}
