"use client"

import { useState, useTransition } from "react"
import { useSmtpSenderForm } from "@/hooks/rhf"
import { modeOf, SMTP_PRESETS } from "@/modules/mail"
import type { Security } from "@/modules/mail"
import { choiceOf, isReadyToSave, needsPasswordOf, presetOrFirst, SMTP_STEPS, usernameOf } from "./smtp-wizard.shared"
import type { SmtpChoice, SmtpFields, SmtpTest, SmtpView } from "./smtp-wizard.shared"
import { useSmtpCommands } from "./useSmtpCommands"

/** What the outgoing-email wizard needs from its drawer. */
interface SmtpWizardInput {
    /** The signed-in person's email: the default address for the test message. */
    readonly ownerEmail: string
    /** The workspace already has a default sender, so this one starts as a spare. */
    readonly hasDefault: boolean
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
    const commands = useSmtpCommands()
    const [index, setIndex] = useState(0)
    const [choice, setChoice] = useState<SmtpChoice>(choiceOf(FIRST_PRESET, FIRST_PRESET.modes[0].id))
    const [conn, setConn] = useState<SmtpView | null>(null)
    const [test, setTest] = useState<SmtpTest>({ to: input.ownerEmail, makeDefault: !input.hasDefault, sentTo: null })
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const preset = presetOrFirst(choice.presetId)
    const mode = modeOf(preset, choice.modeId)
    const form = useSmtpSenderForm({
        needsPassword: needsPasswordOf(preset, choice),
        fixedUser: mode.fixedUser,
        userIsEmail: Boolean(mode.userIsEmail),
    })
    const fields: SmtpFields = form.watch()
    const { setValue } = form

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }

    const save = () => {
        if (conn !== null) return go(3)
        startTransition(async () => {
            const answer = await commands.start({
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
            if (answer.kind !== "ok") return setError(answer.message)
            setConn(answer.value)
            setValue("password", "")
            go(3)
        })
    }

    const sendTest = () => {
        if (conn === null) return
        startTransition(async () => {
            setError(null)
            const answer = await commands.sendTest(conn.id, test.to, test.makeDefault)
            if (answer.kind !== "ok") return setError(answer.message)
            setTest((current) => ({ ...current, sentTo: answer.value.to }))
        })
    }

    return {
        index,
        step: SMTP_STEPS[index] ?? "provider",
        preset,
        choice,
        fields,
        isLocked: conn !== null,
        isReady: isReadyToSave(preset, choice, fields) && form.formState.isValid,
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
            field: (name: keyof SmtpFields, value: string) =>
                setValue(name, value, { shouldValidate: true, shouldDirty: true }),
            testTo: (to: string) => setTest((current) => ({ ...current, to })),
            makeDefault: (makeDefault: boolean) => setTest((current) => ({ ...current, makeDefault })),
        },
    }
}
