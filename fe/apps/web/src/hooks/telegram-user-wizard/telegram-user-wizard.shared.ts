import type { useTelegramUserForm } from "@/hooks/rhf"
import type { useTelegramUserBoot } from "./useTelegramUserBoot"
import type { useTelegramUserLogin } from "./useTelegramUserLogin"
import type { useTelegramUserPicks } from "./useTelegramUserPicks"
import type { TelegramUserStep, TelegramUserField } from "./useTelegramUserWizard"

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

type TelegramUserWizardViewInput = {
    readonly step: TelegramUserStep
    readonly boot: ReturnType<typeof useTelegramUserBoot>
    readonly index: number
    readonly login: ReturnType<typeof useTelegramUserLogin>
    readonly picks: ReturnType<typeof useTelegramUserPicks>
    readonly agentIds: readonly string[]
    readonly error: string | null
    readonly isPending: boolean
    readonly forms: ReturnType<typeof useTelegramUserForm>
    readonly go: (to: number) => void
    readonly setAgentIds: import("react").Dispatch<import("react").SetStateAction<ReadonlyArray<string>>>
    readonly save: () => void
    readonly finish: () => void
    readonly field: (name: TelegramUserField, value: string) => void
    readonly onClose: (changed: boolean) => void
    readonly setError: import("react").Dispatch<import("react").SetStateAction<string | null>>
}

/** Assembles the resolved domain state and commands for its drawing. */
export const viewOf = ({
    step,
    boot,
    index,
    login,
    picks,
    agentIds,
    error,
    isPending,
    forms,
    go,
    setAgentIds,
    save,
    finish,
    field,
    onClose,
    setError,
}: TelegramUserWizardViewInput) => {
    return {
        status: step.started ? "ready" : boot.status,
        bootError: boot.error,
        index,
        login,
        picks,
        agentIds,
        error: error ?? picks.failure,
        isPending,
        values: {
            name: forms.consent.watch("name"),
            consent: forms.consent.watch("consent"),
            phone: forms.phone.watch("phone"),
            code: forms.code.watch("code"),
            password: forms.password.watch("password"),
        },
        valid: {
            consent: forms.consent.formState.isValid,
            phone: forms.phone.formState.isValid,
            code: forms.code.formState.isValid,
            password: forms.password.formState.isValid,
        },
        on: {
            go,
            setAgentIds,
            save,
            finish,
            field,
            close: () => onClose(false),
            consent: (on: boolean) => forms.consent.setValue("consent", on, { shouldValidate: true }),
            reloadChats: () => {
                setError(null)
                picks.reload()
            },
        },
    }
}
