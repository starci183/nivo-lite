"use client"

import { viewOf, BLANK_INITIAL } from "./telegram-user-wizard.shared"
import { useEffect, useReducer, useRef, useState, useTransition } from "react"
import { useSetConnectionAgents, type AgentWish } from "@/hooks/connections"

import { useTelegramUserForm } from "@/hooks/rhf"
import { useTelegramUserBoot } from "./useTelegramUserBoot"
import { useTelegramUserCommands, type TelegramUserCommands } from "./useTelegramUserCommands"

import { useTelegramUserLogin } from "./useTelegramUserLogin"
import { useTelegramUserPicks } from "./useTelegramUserPicks"
import type { Settled } from "../connection-wizard"

/** What the personal Telegram wizard needs from its drawer. */
interface TelegramUserWizardInput {
    /** Continue or edit this existing connection. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Where the wizard stands: the step shown, and whether it edits a connected account (saving then closes it). */
export interface TelegramUserStep {
    /** The server state was read and poured into the steps. */
    readonly started: boolean
    readonly index: number
    readonly editing: boolean
}

const mergeStep = (state: TelegramUserStep, patch: Partial<TelegramUserStep>): TelegramUserStep => ({
    ...state,
    ...patch,
})

/** The text fields of the personal Telegram wizard. */
export type TelegramUserField = "name" | "phone" | "code" | "password"

/**
 * The state machine of the personal Telegram wizard: it first reads whether the server is set up and where a resumed login stands,
 * then runs consent, phone login, chat picks, schedule and agents.
 */
export const useTelegramUserWizard = (input: TelegramUserWizardInput) => {
    const { resumeId, onClose } = input
    const boot = useTelegramUserBoot(resumeId)
    const forms = useTelegramUserForm(BLANK_INITIAL)
    const commands = useTelegramUserCommands()
    const setConnectionAgents = useSetConnectionAgents()
    const [step, patchStep] = useReducer(mergeStep, { started: false, index: 0, editing: false })
    const { index, editing } = step
    const seeded = useRef(false)
    const [error, setError] = useState<string | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [isPending, startTransition] = useTransition()
    const picks = useTelegramUserPicks()

    const go = (to: number) => {
        setError(null)
        patchStep({ index: to })
    }
    const login = useTelegramUserLogin({
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

    // Once the server state is known, the wizard starts where it stands: blank, a resumed login or an edit.
    const { reset: resetConsent } = forms.consent
    const { setStage } = login
    const { restore: restorePicks } = picks
    useEffect(() => {
        if (seeded.current || boot.status !== "ready") return
        const initial = boot.initial
        seeded.current = true
        patchStep({ started: true, index: initial.index, editing: initial.editing })
        resetConsent({ name: initial.name, consent: initial.consent })
        setStage(initial.stage)
        restorePicks(initial, resumeId)
    }, [boot.status, boot.initial, resetConsent, setStage, restorePicks, resumeId])

    const { save, finish, field } = createTelegramUserWizardActions({
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
    })

    return viewOf({
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
    })
}

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

const createTelegramUserWizardActions = ({
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
