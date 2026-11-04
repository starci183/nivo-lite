import type { AgentWish } from "@/hooks/connections"
import type { useTelegramUserForm } from "@/hooks/rhf"
import type { Settled } from "../connection-wizard"
import type { useTelegramUserLogin } from "./useTelegramUserLogin"
import type { useTelegramUserPicks } from "./useTelegramUserPicks"
import type { TelegramUserCommands } from "./useTelegramUserCommands"
import type { TelegramUserField } from "./useTelegramUserWizard"

type TelegramUserWizardActionsInput = {
    readonly startTransition: import("react").TransitionStartFunction
    readonly login: ReturnType<typeof useTelegramUserLogin>
    readonly commands: TelegramUserCommands
    readonly picks: ReturnType<typeof useTelegramUserPicks>
    readonly setError: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly editing: boolean
    readonly onClose: (changed: boolean) => void
    readonly go: (to: number) => void
    readonly setConnectionAgents: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>
    readonly agentIds: readonly string[]
    readonly forms: ReturnType<typeof useTelegramUserForm>
}

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
}: TelegramUserWizardActionsInput) => {
    const save = () =>
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

    const finish = () =>
        startTransition(async () => {
            if (login.connId === null) return onClose(true)
            const answer = await setConnectionAgents(login.connId, agentIds)
            if (answer.kind !== "ok") return setError(answer.message)
            onClose(true)
        })

    const field = (name: TelegramUserField, value: string) => {
        if (name === "name") return forms.consent.setValue("name", value, { shouldValidate: true })
        if (name === "phone") return forms.phone.setValue("phone", value, { shouldValidate: true })
        if (name === "code") return forms.code.setValue("code", value, { shouldValidate: true })
        forms.password.setValue("password", value, { shouldValidate: true })
    }
    return { save, finish, field }
}
