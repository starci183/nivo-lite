/** What kind of chat a dialog is. */
export type ChatKind = "user" | "group" | "channel"

/** A chat the owner ticked. */
export interface PickedChat {
    readonly id: string
    readonly title: string
    readonly kind: ChatKind
}

/** A chat of the account as the picker lists it. */
export interface ChatChoice extends PickedChat {
    readonly unread: number
}

/** How far back the first sync reaches. */
export type SinceDays = 7 | 30

/** The step of the login screen. */
export type LoginStage = "phone" | "code" | "password"

/** Which line tells the owner where the code went (a catalog key of `connectorTelegramUser`). */
export type SentVia = "app" | "sms" | "resent"

/** The most chats one connection reads. */
export const MAX_CHATS = 50

/** The chat kind of a wire value; anything unknown is a group. */
export const chatKindOf = (value: string): ChatKind => (value === "user" || value === "channel" ? value : "group")

/** The window of a wire value; anything but 30 is 7. */
export const sinceDaysOf = (value: number): SinceDays => (value === 30 ? 30 : 7)

/** Where the wizard starts: a blank start, a resumed login or an edit of a connected account. */
export interface TelegramInitial {
    readonly name: string
    readonly consent: boolean
    readonly everyMinutes: number | null
    readonly picked: ReadonlyArray<PickedChat>
    readonly sinceDays: SinceDays
    readonly stage: LoginStage
    readonly index: number
    readonly editing: boolean
}

/** A blank start. */
export const BLANK_INITIAL: TelegramInitial = {
    name: "",
    consent: false,
    everyMinutes: null,
    picked: [],
    sinceDays: 7,
    stage: "phone",
    index: 0,
    editing: false,
}
