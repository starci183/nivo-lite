import { useState, useTransition } from "react"
import { WEBHOOK_EVENTS } from "@/lib/webhook-shared"
import { useChannelReason } from "@/hooks/connection-wizard"
import type { WebhookTestVerdict, WebhookView } from "@/modules/types"
import { WEBHOOK_STEPS } from "./webhook-wizard.shared"
import type { WebhookActions } from "./webhook-wizard.shared"
import { useWebhookReason } from "./useWebhookReason"

/** What the webhook wizard needs from its drawer. */
interface WebhookWizardInput {
    /** The name the connection starts with. */
    readonly defaultName: string
    readonly actions: WebhookActions
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The webhook wizard's state machine: address and events, the signing key, a test send, done. */
export const useWebhookWizard = (input: WebhookWizardInput) => {
    const webhookReason = useWebhookReason()
    const testReason = useChannelReason()
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
            const answer = await input.actions.start(form, events)
            if (answer.kind !== "ok") return setError(webhookReason(answer.code))
            setCreated(answer.value)
            setIndex(1)
        })

    const sendTest = () =>
        startTransition(async () => {
            if (created === null) return
            setError(null)
            const answer = await input.actions.test(created.id)
            if (answer.kind !== "ok") return setError(testReason(answer.code))
            setTest(answer.value)
        })

    const finish = () =>
        startTransition(async () => {
            if (created === null) return
            setError(null)
            const answer = await input.actions.finish(created.id)
            if (answer.kind !== "ok") return setError(webhookReason(answer.code))
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
