"use client"

import { useState, useTransition, type SetStateAction, type Dispatch } from "react"
import { SECRET_STEP, WEBHOOK_STEPS } from "./webhook-wizard.shared"
import type { WebhookTestVerdict, WebhookView } from "@/modules/types"

import { useWebhookCommands } from "./useWebhookCommands"

/** What the webhook wizard needs from its drawer. */
interface WebhookWizardInput {
    /** The name the connection starts with. */
    readonly defaultName: string
    /** The ids of the events the back end offers (the installed plugins' and the engine's): all are picked until the owner changes the choice. */
    readonly availableEvents: ReadonlyArray<string>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

type UseWebhookWizardResult = {
    index: number
    step: "address" | "secret" | "test" | "done"
    form: {
        name: string
        url: string
    }
    events: readonly string[]
    signingSecret: string
    test: WebhookTestVerdict | null
    error: string | null
    isPending: boolean
    on: {
        go: (to: number) => void
        save: () => void
        sendTest: () => void
        finish: () => void
        close: () => void
        name: (name: string) => void
        url: (url: string) => void
        events: Dispatch<SetStateAction<readonly string[]>>
    }
}

/** The webhook wizard's state machine: address and events, the signing key, a test send, done. */
export const useWebhookWizard = (input: WebhookWizardInput): UseWebhookWizardResult => {
    const commands = useWebhookCommands()
    const [index, setIndex] = useState(0)
    const [form, setForm] = useState({ name: input.defaultName, url: "" })
    const [picked, setPicked] = useState<ReadonlyArray<string> | null>(null)
    const events = picked ?? input.availableEvents
    const setEvents: Dispatch<SetStateAction<readonly string[]>> = (next) =>
        setPicked((current) => (typeof next === "function" ? next(current ?? input.availableEvents) : next))
    const [created, setCreated] = useState<WebhookView | null>(null)
    const [test, setTest] = useState<WebhookTestVerdict | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const save = (): void =>
        startTransition(async () => {
            setError(null)
            const answer = await commands.start(form, events)
            if (answer.kind !== "ok") return setError(answer.message)
            setCreated(answer.value)
            setIndex(1)
        })

    const sendTest = (): void =>
        startTransition(async () => {
            if (created === null) return
            setError(null)
            const answer = await commands.test(created.id)
            if (answer.kind !== "ok") return setError(answer.message)
            setTest(answer.value)
        })

    const finish = (): void =>
        startTransition(async () => {
            if (created === null) return
            setError(null)
            const answer = await commands.finish(created.id)
            if (answer.kind !== "ok") return setError(answer.message)
            input.onClose(true)
        })

    return {
        index,
        step: WEBHOOK_STEPS[index] ?? "address",
        form,
        events,
        signingSecret: created === null ? "" : created.signingSecret,
        test,
        error,
        isPending,
        on: {
            go: (to: number): void => {
                setError(null)
                // The signing secret is shown once: leaving its step drops it from memory.
                if (index === SECRET_STEP && to !== SECRET_STEP)
                    setCreated((current) => (current === null ? current : { ...current, signingSecret: "" }))
                setIndex(to)
            },
            save,
            sendTest,
            finish,
            close: (): void => input.onClose(created !== null),
            name: (name: string): void => setForm((current) => ({ ...current, name })),
            url: (url: string): void => setForm((current) => ({ ...current, url })),
            events: setEvents,
        },
    }
}
