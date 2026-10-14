"use client"

import { useState, useTransition } from "react"
import { WEBHOOK_EVENTS } from "./webhook-wizard.shared"
import type { WebhookTestVerdict, WebhookView } from "@/modules/types"
import { WEBHOOK_STEPS } from "./webhook-wizard.shared"
import { useWebhookCommands } from "./useWebhookCommands"

/** What the webhook wizard needs from its drawer. */
interface WebhookWizardInput {
    /** The name the connection starts with. */
    readonly defaultName: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The webhook wizard's state machine: address and events, the signing key, a test send, done. */
export const useWebhookWizard = (input: WebhookWizardInput) => {
    const commands = useWebhookCommands()
    const [index, setIndex] = useState(0)
    const [form, setForm] = useState({ name: input.defaultName, url: "" })
    const [events, setEvents] = useState<ReadonlyArray<string>>([...WEBHOOK_EVENTS])
    const [created, setCreated] = useState<WebhookView | null>(null)
    const [test, setTest] = useState<WebhookTestVerdict | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const save = () =>
        startTransition(async () => {
            setError(null)
            const answer = await commands.start(form, events)
            if (answer.kind !== "ok") return setError(answer.message)
            setCreated(answer.value)
            setIndex(1)
        })

    const sendTest = () =>
        startTransition(async () => {
            if (created === null) return
            setError(null)
            const answer = await commands.test(created.id)
            if (answer.kind !== "ok") return setError(answer.message)
            setTest(answer.value)
        })

    const finish = () =>
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
            go: (to: number) => {
                setError(null)
                setIndex(to)
            },
            save,
            sendTest,
            finish,
            close: () => input.onClose(created !== null),
            name: (name: string) => setForm((current) => ({ ...current, name })),
            url: (url: string) => setForm((current) => ({ ...current, url })),
            events: setEvents,
        },
    }
}
