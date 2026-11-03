import type { useTelegramUserForm } from "@/hooks/rhf"
import type { DataSlot, SlotRead } from "@/modules/types"
import type { useTelegramUserBoot } from "./useTelegramUserBoot"
import type { useTelegramUserLogin } from "./useTelegramUserLogin"
import type { useTelegramUserPicks } from "./useTelegramUserPicks"
import type { TelegramUserStep, TelegramUserField } from "./useTelegramUserWizard"

import type { Dispatch, SetStateAction } from "react"

/** The status of the chat list read. */
interface ChatsRead {
    readonly loading: boolean
    readonly failed: boolean
}

/** The slot of the chat list: loading while the dialogs are read, failed when they could not be, else the picker. */
export const chatsSlotOf = <T>(read: ChatsRead, picker: T): DataSlot<T> => {
    if (read.loading) return { isLoading: true }
    return read.failed ? { isError: true } : { items: picker }
}

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

type ViewOfResult = {
    reads: readonly SlotRead<unknown>[]
    bootData:
        | {
              readonly isConfigured: boolean
          }
        | undefined
    bootError: string | null
    index: number
    login: {
        stage: LoginStage
        connId: string | null
        sentVia: SentVia | null
        setStage: Dispatch<SetStateAction<LoginStage>>
        sendCode: () => void
        confirmCode: () => void
        confirmPassword: () => void
        resend: () => void
        cancel: () => void
    }
    picks: {
        reads: readonly SlotRead<unknown>[]
        loading: boolean
        failed: boolean
        failure: string | null
        picked: readonly PickedChat[]
        pickedIds: Set<string>
        visible: readonly ChatChoice[]
        full: boolean
        query: string
        sinceDays: SinceDays
        every: string
        change: (ids: ReadonlyArray<string>) => void
        setQuery: Dispatch<SetStateAction<string>>
        setSinceDays: Dispatch<SetStateAction<SinceDays>>
        setEvery: Dispatch<SetStateAction<string>>
        restore: (initial: TelegramInitial, resumeId: string | undefined) => void
        load: Dispatch<SetStateAction<string | undefined>>
        reload: () => void
    }
    agentIds: readonly string[]
    error: string | null
    isPending: boolean
    values: {
        name: string
        consent: boolean
        phone: string
        code: string
        password: string
    }
    valid: {
        consent: boolean
        phone: boolean
        code: boolean
        password: boolean
    }
    on: {
        go: (to: number) => void
        setAgentIds: Dispatch<SetStateAction<readonly string[]>>
        save: () => void
        finish: () => void
        field: (name: TelegramUserField, value: string) => void
        retry: () => void
        close: () => void
        consent: (on: boolean) => void
        reloadChats: () => void
    }
}

/** Assembles the resolved domain state and commands for its drawing. */
export const viewOf = ({
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
}: TelegramUserWizardViewInput): ViewOfResult => {
    return {
        reads: boot.reads,
        bootData: boot.bootData,
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
            retry: boot.retry,
            close: (): void => onClose(false),
            consent: (on: boolean): void => forms.consent.setValue("consent", on, { shouldValidate: true }),
            reloadChats: (): void => {
                setError(null)
                picks.reload()
            },
        },
    }
}
