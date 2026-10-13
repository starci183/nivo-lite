"use client"

import { useState, useTransition } from "react"
import { useSetConnectionAgents } from "@/hooks/connections"
import { useTelegramUserForm } from "@/hooks/rhf"
import type { TelegramInitial } from "./telegram-user-wizard.shared"
import { useTelegramUserCommands } from "./useTelegramUserCommands"
import { useTelegramUserLogin } from "./useTelegramUserLogin"
import { useTelegramUserPicks } from "./useTelegramUserPicks"

/** What the personal Telegram wizard needs from its drawer. */
interface TelegramUserWizardInput {
    /** Continue or edit this existing connection. */
    readonly resumeId: string | undefined
    /** Where the wizard starts (read before it opened). */
    readonly initial: TelegramInitial
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The state machine of the personal Telegram wizard: consent, phone login, chat picks, schedule, agents. */
export const useTelegramUserWizard = (input: TelegramUserWizardInput) => {
    const { resumeId, initial, onClose } = input
    const forms = useTelegramUserForm(initial)
    const commands = useTelegramUserCommands()
    const setConnectionAgents = useSetConnectionAgents()
    const [index, setIndex] = useState(initial.index)
    const [error, setError] = useState<string | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [isPending, startTransition] = useTransition()
    const picks = useTelegramUserPicks(initial, resumeId)

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }
    const login = useTelegramUserLogin({
        stage: initial.stage,
        resumeId,
        forms,
        commands,
        run: startTransition,
        fail: setError,
        onLoggedIn: (id) => {
            forms.code.reset()
            forms.password.reset()
            picks.load(id)
            go(2)
        },
        onCancelled: () => onClose(false),
    })

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
            if (initial.editing) return onClose(true)
            go(4)
        })

    const finish = () =>
        startTransition(async () => {
            if (login.connId === null) return onClose(true)
            const answer = await setConnectionAgents(login.connId, agentIds)
            if (answer.kind !== "ok") return setError(answer.message)
            onClose(true)
        })

    const reloadChats = () => {
        setError(null)
        picks.reload()
    }

    return {
        forms,
        index,
        login,
        picks,
        agentIds,
        error: error ?? picks.failure,
        isPending,
        on: { go, setAgentIds, save, finish, reloadChats },
    }
}

/** What {@link useTelegramUserWizard} answers, for the step components. */
export type TelegramUserWizardState = ReturnType<typeof useTelegramUserWizard>
