"use client"

import { BLANK_INITIAL } from "@/hooks/telegram-chats"
import { createTelegramUserWizardActions, viewOf, type ViewOfResult } from "./telegram-user-wizard.shared"
import { useEffect, useReducer, useRef, useState, useTransition } from "react"
import { useSetConnectionAgents } from "@/hooks/connections"

import { useTelegramUserForm } from "@/hooks/rhf"
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

type UseTelegramUserWizardResult = ViewOfResult

/**
 * The state machine of the personal Telegram wizard: it first reads whether the server is set up and where a resumed login stands,
 * then runs consent, phone login, chat picks, schedule and agents.
 */
export const useTelegramUserWizard = (input: TelegramUserWizardInput): UseTelegramUserWizardResult => {
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
    const startAt = "items" in boot.slot && boot.slot.items.isConfigured ? boot.slot.items.initial : undefined
    const { reset: resetConsent } = forms.consent
    const { setStage } = login
    const { restore: restorePicks } = picks
    useEffect(() => {
        if (seeded.current || startAt === undefined) return
        seeded.current = true
        patchStep({ started: true, index: startAt.index, editing: startAt.editing })
        resetConsent({ name: startAt.name, consent: startAt.consent })
        setStage(startAt.stage)
        restorePicks(startAt, resumeId)
    }, [startAt, resetConsent, setStage, restorePicks, resumeId])

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
