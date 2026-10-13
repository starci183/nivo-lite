import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { allAgentIds, useChannelReason } from "@/hooks/connection-wizard"
import type { AgentOption, WizardNote } from "@/modules/types"
import { checkNoteOf, TELEGRAM_STEPS } from "./telegram-wizard.shared"
import type { TelegramActions } from "./telegram-wizard.shared"

/** What the Telegram wizard needs from its drawer. */
interface TelegramWizardInput {
    readonly agents: ReadonlyArray<AgentOption>
    readonly actions: TelegramActions
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * The Telegram wizard's state machine: BotFather steps, paste the token (the api checks it and registers the webhook), check the bot,
 * attach it to the agents. The connection is created when the token step ends; the check then runs by itself.
 */
export const useTelegramWizard = (input: TelegramWizardInput) => {
    const tc = useTranslations("connections")
    const reasonOf = useChannelReason()
    const [index, setIndex] = useState(0)
    const [form, setForm] = useState({ name: "", token: "" })
    const [connectionId, setConnectionId] = useState<string | null>(null)
    const [check, setCheck] = useState<WizardNote | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isChecking, startChecking] = useTransition()

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }

    const runCheck = (id: string) =>
        startChecking(async () => {
            setCheck(null)
            const answer = await input.actions.check(id)
            setCheck(
                answer.kind === "ok"
                    ? checkNoteOf(answer.value, tc)
                    : { tone: "negative", text: reasonOf(answer.code) },
            )
        })

    const connect = () =>
        startTransition(async () => {
            const answer = await input.actions.connect(form)
            if (answer.kind !== "ok") return setError(reasonOf(answer.code))
            setConnectionId(answer.value.connection.id)
            go(2)
            runCheck(answer.value.connection.id)
        })

    const finish = () =>
        startTransition(async () => {
            if (connectionId === null) return input.onClose(false)
            const answer = await input.actions.setAgents(connectionId, agentIds)
            if (answer.kind !== "ok") return setError(reasonOf(answer.code))
            input.onClose(true)
        })

    return {
        index,
        step: TELEGRAM_STEPS[index] ?? "bot",
        form,
        check,
        error,
        isPending,
        isChecking,
        agentIds,
        on: {
            go,
            connect,
            finish,
            retry: () => connectionId !== null && runCheck(connectionId),
            close: () => input.onClose(connectionId !== null),
            name: (name: string) => setForm((current) => ({ ...current, name })),
            token: (token: string) => setForm((current) => ({ ...current, token })),
            agents: setAgentIds,
        },
    }
}
