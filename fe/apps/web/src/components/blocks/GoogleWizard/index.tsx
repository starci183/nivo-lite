"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { providerKey } from "@/hooks/connection-providers"
import { useAuthorizeGoogle } from "@/hooks/connections"
import { GoogleWizardBase } from "./component"

/** The reasons the callback puts in the return address. */
const GOOGLE_FAILURES = ["denied", "unavailable", "state", "no_refresh"] as const

/** One reason the callback puts in the return address. */
type GoogleFailure = (typeof GOOGLE_FAILURES)[number]

/** The sentence key of each known Google failure. */
const FAILURE_KEYS = {
    denied: "failDenied",
    unavailable: "failUnavailable",
    state: "failState",
    no_refresh: "failNoRefresh",
} as const satisfies Record<GoogleFailure, string>

/** The sentence key of a Google failure, including the generic one. */
type GoogleFailureMessage = (typeof FAILURE_KEYS)[GoogleFailure] | "failGeneric"

/** Whether the return address names one of the known Google failures. */
const isGoogleFailure = (value: string): value is GoogleFailure => GOOGLE_FAILURES.some((key) => key === value)

/** The sentence key for a Google failure, or the generic one when the reason is unknown. */
const googleFailureMessage = (reason: string): GoogleFailureMessage =>
    isGoogleFailure(reason) ? FAILURE_KEYS[reason] : "failGeneric"

/** What the board hands the Google wizard. */
interface GoogleWizardProps {
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Google in the shared wizard frame: what NIVO will be allowed (only files it creates), then Connect Google (OAuth), then Done; also the landing of `?google=ok|error`. */
export const GoogleWizard = (props: GoogleWizardProps) => {
    const t = useTranslations("googleWizard")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const params = useSearchParams()
    const authorize = useAuthorizeGoogle()
    const result = params.get("google")
    const reason = params.get("reason") ?? ""
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const connect = () =>
        startTransition(async () => {
            setError(null)
            const answer = await authorize("/connections")
            if (answer.kind !== "ok") return setError(answer.message)
            window.location.assign(answer.value)
        })
    const failure = result === "error" ? t(googleFailureMessage(reason)) : null
    const steps = [t("stepConnect"), t("stepDone")]
    const index = result === "ok" ? 1 : 0
    return (
        <GoogleWizardBase
            props={{
                title: tw("title", { provider: tc(providerKey("google", "title")) }),
                stepLabel: tw("stepOf", { n: index + 1, total: steps.length }),
                steps,
                index,
                failure,
                error,
                isPending,
                text: {
                    allowTitle: t("allowTitle"),
                    allowOnlyFiles: t("allowOnlyFiles"),
                    allowNoOthers: t("allowNoOthers"),
                    allowRevoke: t("allowRevoke"),
                    connect: t("connect"),
                    close: tw("close"),
                    done: tw("done"),
                    failTitle: t("failTitle"),
                    doneTitle: t("doneTitle"),
                    doneBody: t("doneBody", { email: t("doneNoEmail") }),
                },
            }}
            on={{ connect, close: props.onClose }}
        />
    )
}
