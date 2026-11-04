import type { Dispatch, SetStateAction, TransitionStartFunction } from "react"
import type { AgentWish } from "@/hooks/connections"
import type { useTelegramUserForm } from "@/hooks/rhf"
import type { SlotRead } from "@/modules/types"
import type { Settled } from "../connection-wizard"
import type { TelegramUserCommands } from "./useTelegramUserCommands"
import type { useTelegramUserBoot } from "./useTelegramUserBoot"
import type { useTelegramUserLogin } from "./useTelegramUserLogin"
import type { useTelegramUserPicks } from "./useTelegramUserPicks"
import type { TelegramUserField } from "./useTelegramUserWizard"

type TelegramUserWizardActionsInput = {
    readonly startTransition: TransitionStartFunction
    readonly login: ReturnType<typeof useTelegramUserLogin>
    readonly commands: TelegramUserCommands
    readonly picks: ReturnType<typeof useTelegramUserPicks>
    readonly setError: Dispatch<SetStateAction<string | null>>
    readonly editing: boolean
    readonly onClose: (changed: boolean) => void
    readonly go: (to: number) => void
    readonly setConnectionAgents: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>
    readonly agentIds: readonly string[]
    readonly forms: ReturnType<typeof useTelegramUserForm>
}

/** The commands the wizard buttons call: save the picks, finish with the agents, and write one text field. */
export interface TelegramUserWizardActions {
    readonly save: () => void
    readonly finish: () => void
    readonly field: (name: TelegramUserField, value: string) => void
}

/** Builds the wizard's save, finish and field commands over its resolved state. */
export const createTelegramUserWizardActions = ({
    startTransition,
    login,
    commands,
    picks,
    setError,
    editing,
    onClose,
    go,
    setConnectionAgents,
    agentIds,
    forms,
}: TelegramUserWizardActionsInput): TelegramUserWizardActions => {
    const save = (): void =>
        startTransition(async () => {
            if (login.connId === null) return
            const answer = await commands.save({
                connectionId: login.connId,
                chats: picks.picked,
                sinceDays: picks.sinceDays,
                everyMinutes: Number(picks.every) || null,
            })
            if (answer.kind !== "ok") return setError(answer.message)
            if (editing) return onClose(true)
            go(4)
        })

    const finish = (): void =>
        startTransition(async () => {
            if (login.connId === null) return onClose(true)
            const answer = await setConnectionAgents(login.connId, agentIds)
            if (answer.kind !== "ok") return setError(answer.message)
            onClose(true)
        })

    const field = (name: TelegramUserField, value: string): void => {
        if (name === "name") return void forms.consent.setValue("name", value, { shouldValidate: true })
        if (name === "phone") return void forms.phone.setValue("phone", value, { shouldValidate: true })
        if (name === "code") return void forms.code.setValue("code", value, { shouldValidate: true })
        forms.password.setValue("password", value, { shouldValidate: true })
    }
    return { save, finish, field }
}

type TelegramUserWizardViewInput = {
    readonly boot: ReturnType<typeof useTelegramUserBoot>
    readonly index: number
    readonly login: ReturnType<typeof useTelegramUserLogin>
    readonly picks: ReturnType<typeof useTelegramUserPicks>
    readonly agentIds: readonly string[]
    readonly error: string | null
    readonly isPending: boolean
    readonly forms: ReturnType<typeof useTelegramUserForm>
    readonly go: (to: number) => void
    readonly setAgentIds: Dispatch<SetStateAction<ReadonlyArray<string>>>
    readonly save: () => void
    readonly finish: () => void
    readonly field: (name: TelegramUserField, value: string) => void
    readonly onClose: (changed: boolean) => void
    readonly setError: Dispatch<SetStateAction<string | null>>
}

/** Everything the wizard drawing reads and calls: server state, login, picks, form values and the commands. */
export type ViewOfResult = {
    reads: readonly SlotRead<unknown>[]
    bootData: ReturnType<typeof useTelegramUserBoot>["bootData"]
    bootError: ReturnType<typeof useTelegramUserBoot>["error"]
    index: number
    login: ReturnType<typeof useTelegramUserLogin>
    picks: ReturnType<typeof useTelegramUserPicks>
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
