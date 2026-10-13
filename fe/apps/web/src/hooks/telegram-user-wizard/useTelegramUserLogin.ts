"use client"

import { useState } from "react"
import type { TransitionStartFunction } from "react"
import type { useTelegramUserForm } from "@/hooks/rhf"
import type { LoginStage, SentVia } from "./telegram-user-wizard.shared"
import type { TelegramUserCommands } from "./useTelegramUserCommands"

/** What the login steps need from the wizard around them. */
interface TelegramLoginInput {
    /** The login screen the wizard opens on. */
    readonly stage: LoginStage
    /** The connection being resumed, if any. */
    readonly resumeId: string | undefined
    readonly forms: ReturnType<typeof useTelegramUserForm>
    readonly commands: TelegramUserCommands
    readonly run: TransitionStartFunction
    /** Shows (or with null clears) the failure line. */
    readonly fail: (message: string | null) => void
    /** The account is logged in: go on to the chats. */
    readonly onLoggedIn: (connectionId: string) => void
    /** The login was given up. */
    readonly onCancelled: () => void
}

/** The phone, code and two-step password steps of the personal Telegram login. */
export const useTelegramUserLogin = (input: TelegramLoginInput) => {
    const { forms, commands, run, fail, onLoggedIn, onCancelled } = input
    const [stage, setStage] = useState<LoginStage>(input.stage)
    const [connId, setConnId] = useState<string | null>(input.resumeId ?? null)
    const [sentVia, setSentVia] = useState<SentVia | null>(null)

    const sendCode = () =>
        run(async () => {
            const { name, consent } = forms.consent.getValues()
            const answer = await commands.start({
                name,
                consent,
                phone: forms.phone.getValues("phone"),
                connectionId: connId,
            })
            if (answer.kind !== "ok") return fail(answer.message)
            setConnId(answer.value.connectionId)
            setSentVia(answer.value.viaApp ? "app" : "sms")
            setStage("code")
            fail(null)
        })

    const confirmCode = () =>
        run(async () => {
            if (connId === null) return
            const answer = await commands.submitCode(connId, forms.code.getValues("code"))
            if (answer.kind !== "ok") return fail(answer.message)
            fail(null)
            if (answer.value.stage === "password") {
                setStage("password")
                return forms.code.reset()
            }
            onLoggedIn(connId)
        })

    const confirmPassword = () =>
        run(async () => {
            if (connId === null) return
            const answer = await commands.submitPassword(connId, forms.password.getValues("password"))
            if (answer.kind !== "ok") return fail(answer.message)
            onLoggedIn(connId)
        })

    const resend = () =>
        run(async () => {
            if (connId === null) return
            const answer = await commands.resend(connId)
            if (answer.kind !== "ok") return fail(answer.message)
            setSentVia("resent")
            fail(null)
        })

    const cancel = () =>
        run(async () => {
            if (connId !== null) await commands.cancel(connId)
            onCancelled()
        })

    return { stage, connId, sentVia, sendCode, confirmCode, confirmPassword, resend, cancel }
}
