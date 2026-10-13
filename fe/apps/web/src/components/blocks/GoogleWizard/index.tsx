"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { providerKey } from "@/hooks/connection-providers"
import { writeGoogleAuthorize } from "@/modules/api/connections/write-google-authorize"
import { messageKeyOf } from "@/modules/api/connections/connections.mapper"
import { GoogleWizardBase } from "./component"

/** The reasons the callback puts in the return address, with the sentence of each. */
const FAILURE_KEYS = {
    denied: "failDenied",
    unavailable: "failUnavailable",
    state: "failState",
    no_refresh: "failNoRefresh",
} as const

/** What the board hands the Google wizard. */
interface GoogleWizardProps {
    readonly workspaceId: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Google in the shared wizard frame: what NIVO will be allowed (only files it creates), then Connect Google (OAuth), then Done; also the landing of `?google=ok|error`. */
export const GoogleWizard = (props: GoogleWizardProps) => {
    const t = useTranslations("googleWizard")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const params = useSearchParams()
    const result = params.get("google")
    const reason = params.get("reason") ?? ""
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const connect = () =>
        startTransition(async () => {
            setError(null)
            const answer = await writeGoogleAuthorize({ workspaceId: props.workspaceId, returnTo: "/connections" })
            if (answer.kind !== "ok") {
                const key = messageKeyOf(answer.fault.code)
                return setError(key === "errNotConfigured" ? t("errNotConfigured") : t("errStart"))
            }
            window.location.assign(answer.value.url)
        })
    const failure =
        result === "error"
            ? t(reason in FAILURE_KEYS ? FAILURE_KEYS[reason as keyof typeof FAILURE_KEYS] : "failGeneric")
            : null
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
