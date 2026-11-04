import type { useTelegramUserForm } from "@/hooks/rhf"
import type { SlotRead } from "@/modules/types"
import type {
    PickedChat,
    ChatChoice,
    SinceDays,
    LoginStage,
    SentVia,
    TelegramInitial,
} from "./telegram-user-wizard.shared"
import type { useTelegramUserBoot } from "./useTelegramUserBoot"
import type { useTelegramUserLogin } from "./useTelegramUserLogin"
import type { useTelegramUserPicks } from "./useTelegramUserPicks"
import type { TelegramUserStep, TelegramUserField } from "./useTelegramUserWizard"
import type { Dispatch, SetStateAction } from "react"

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

export type ViewOfResult = {
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
