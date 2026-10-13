import { useState, useTransition } from "react"
import { RESEND_COOLDOWN_SECONDS, authErrorKey } from "./auth.shared"
import type { AuthErrorKey } from "./auth.shared"
import { useCooldown } from "./useCooldown"

/** The outcome of a resend, as the caller's action reports it. */
type ResendOutcome = { readonly kind: "ok" } | { readonly kind: string; readonly code: string }

/** The result of the last resend, before it is put into words. */
type ResendResult = { readonly sent: true } | { readonly sent: false; readonly key: AuthErrorKey }

/** The sentences the resend control speaks, resolved by the caller from the catalog. */
type ResendTexts = {
    readonly sentTitle: string
    readonly sentText: string
    readonly failedTitle: string
    readonly describe: (key: AuthErrorKey) => string
    readonly resendLabel: string
    readonly waitLabel: (seconds: number) => string
}

/** What the `CheckEmail` body needs from the resend flow. */
type ResendView = {
    readonly notice?: { readonly tone: "affirmative" | "negative"; readonly title: string; readonly text: string }
    readonly resendLabel: string
    readonly isPending: boolean
    readonly isWaiting: boolean
    readonly onResend: () => void
}

/** What a "send the mail again" control gives back. */
type Resend = {
    readonly view: ResendView
    /** Starts the cooldown for the mail the form itself just sent and clears any old notice. */
    readonly arm: () => void
}

const noticeOf = (result: ResendResult | null, texts: ResendTexts): ResendView["notice"] => {
    if (result === null) return undefined
    if (result.sent) return { tone: "affirmative", title: texts.sentTitle, text: texts.sentText }
    return { tone: "negative", title: texts.failedTitle, text: texts.describe(result.key) }
}

/** Runs the caller's resend action once at a time, keeps the notice and holds a 60 second cooldown after each send. */
export const useResendEmail = (send: () => Promise<ResendOutcome>, texts: ResendTexts): Resend => {
    const { left, start } = useCooldown(RESEND_COOLDOWN_SECONDS)
    const [isPending, startTransition] = useTransition()
    const [result, setResult] = useState<ResendResult | null>(null)
    return {
        arm: () => {
            setResult(null)
            start()
        },
        view: {
            notice: noticeOf(result, texts),
            resendLabel: left > 0 ? texts.waitLabel(left) : texts.resendLabel,
            isPending,
            isWaiting: left > 0,
            onResend: () => {
                startTransition(async () => {
                    const outcome = await send()
                    if (outcome.kind === "ok") {
                        setResult({ sent: true })
                        start()
                        return
                    }
                    setResult({ sent: false, key: authErrorKey("code" in outcome ? outcome.code : "") })
                })
            },
        },
    }
}
