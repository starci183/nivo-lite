import { useState, useTransition } from "react"
import { SMTP_PRESETS } from "@/lib/email/presets"
import type { Security } from "@/lib/email/presets"
import type { SmtpView } from "@/lib/email-actions"
import { choiceOf, isReadyToSave, needsPasswordOf, presetOrFirst, SMTP_STEPS, usernameOf } from "./smtp-wizard.shared"
import type { SmtpActions, SmtpChoice, SmtpFields, SmtpTest } from "./smtp-wizard.shared"

/** What the outgoing-email wizard needs from its drawer. */
interface SmtpWizardInput {
    /** The signed-in person's email: the default address for the test message. */
    readonly ownerEmail: string
    /** The workspace already has a default sender, so this one starts as a spare. */
    readonly hasDefault: boolean
    readonly actions: SmtpActions
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

const FIRST_PRESET = SMTP_PRESETS[0]

/**
 * The outgoing-email wizard's state machine: 1 pick where the mailbox lives (host, port and security are prefilled), 2 a step-by-step
 * guide for a non-technical owner, 3 the sender details and password (stored encrypted, never shown again), 4 a test email: the connection
 * becomes active only after one test email is really sent.
 */
export const useSmtpWizard = (input: SmtpWizardInput) => {
    const [index, setIndex] = useState(0)
    const [choice, setChoice] = useState<SmtpChoice>(choiceOf(FIRST_PRESET, FIRST_PRESET.modes[0].id))
    const [fields, setFields] = useState<SmtpFields>({
        fromName: "",
        fromEmail: "",
        replyTo: "",
        user: "",
        password: "",
    })
    const [conn, setConn] = useState<SmtpView | null>(null)
    const [test, setTest] = useState<SmtpTest>({ to: input.ownerEmail, makeDefault: !input.hasDefault, sentTo: null })
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const preset = presetOrFirst(choice.presetId)

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }

    const save = () => {
        if (conn !== null) return go(3)
        startTransition(async () => {
            const answer = await input.actions.start({
                preset: preset.id,
                host: choice.host,
                port: Number(choice.port),
                security: choice.security,
                user: usernameOf(preset, choice, fields),
                password: fields.password,
                fromName: fields.fromName,
                fromEmail: fields.fromEmail,
                replyTo: fields.replyTo,
            })
            if (!answer.ok) return setError(answer.error)
            setConn(answer.data)
            setFields((current) => ({ ...current, password: "" }))
            go(3)
        })
    }

    const sendTest = () => {
        if (conn === null) return
        startTransition(async () => {
            setError(null)
            const answer = await input.actions.sendTest(conn.id, test.to, test.makeDefault)
            if (!answer.ok) return setError(answer.error)
            setTest((current) => ({ ...current, sentTo: answer.data.to }))
        })
    }

    return {
        index,
        step: SMTP_STEPS[index] ?? "provider",
        preset,
        choice,
        fields,
        isLocked: conn !== null,
        isReady: isReadyToSave(preset, choice, fields),
        needsPassword: needsPasswordOf(preset, choice),
        test,
        error,
        isPending,
        on: {
            go,
            save,
            sendTest,
            close: (changed: boolean) => input.onClose(changed),
            preset: (id: string) => setChoice(choiceOf(presetOrFirst(id), presetOrFirst(id).modes[0].id)),
            mode: (id: string) => setChoice(choiceOf(preset, id)),
            host: (host: string) => setChoice((current) => ({ ...current, host })),
            port: (port: string) => setChoice((current) => ({ ...current, port })),
            security: (security: Security) => setChoice((current) => ({ ...current, security })),
            field: (name: keyof SmtpFields, value: string) => setFields((current) => ({ ...current, [name]: value })),
            testTo: (to: string) => setTest((current) => ({ ...current, to })),
            makeDefault: (makeDefault: boolean) => setTest((current) => ({ ...current, makeDefault })),
        },
    }
}
