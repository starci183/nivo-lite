"use client"

import { useEffect, useReducer, useRef, useState, useTransition } from "react"
import { useSetConnectionAgents } from "@/hooks/connections"
import { useTelegramUserForm } from "@/hooks/rhf"
import { BLANK_INITIAL } from "./telegram-user-wizard.shared"
import { useTelegramUserBoot } from "./useTelegramUserBoot"
import { useTelegramUserCommands } from "./useTelegramUserCommands"
import { useTelegramUserLogin } from "./useTelegramUserLogin"
import { useTelegramUserPicks } from "./useTelegramUserPicks"

/** What the personal Telegram wizard needs from its drawer. */
interface TelegramUserWizardInput {
    /** Continue or edit this existing connection. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Where the wizard stands: the step shown, and whether it edits a connected account (saving then closes it). */
interface TelegramUserStep {
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
type TelegramUserField = "name" | "phone" | "code" | "password"

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
