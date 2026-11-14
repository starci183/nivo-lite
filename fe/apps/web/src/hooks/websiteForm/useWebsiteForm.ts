"use client"

import { useState } from "react"
import { useMutateSubmitWebsiteLeadSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/failure"
import { websiteVisitorId } from "@/modules/storage"
import type { WebsiteFormStatus, WebsiteFormValues } from "@/modules/types"

/** What the hosted form of a shop website draws and does. */
interface WebsiteFormState {
    readonly values: WebsiteFormValues
    readonly status: WebsiteFormStatus
    readonly setName: (value: string) => void
    readonly setPhone: (value: string) => void
    readonly setMessage: (value: string) => void
    readonly submit: () => void
    /** Starts a new form after one was sent. */
    readonly again: () => void
}

const EMPTY: WebsiteFormValues = { name: "", phone: "", message: "" }

/** The error codes of the back end that say why a form was refused, and the status each one is. */
const STATUS_OF: Readonly<Record<string, WebsiteFormStatus>> = {
    INBOX_LEADS_SITE_OFF: "off",
    INBOX_LEADS_SITE_UNKNOWN: "off",
    ENTITY_ENGINE_AGENT_MISSING: "off",
    INBOX_LEADS_SUBMISSION_EMPTY: "empty",
}

/** The form of the hosted page: the three fields, the send and what came of it. */
export const useWebsiteForm = (siteKey: string): WebsiteFormState => {
    const [values, setValues] = useState<WebsiteFormValues>(EMPTY)
    const [status, setStatus] = useState<WebsiteFormStatus>("idle")
    const send = useMutateSubmitWebsiteLeadSwr()
    return {
        values,
        status: send.isMutating ? "sending" : status,
        setName: (name) => setValues((current) => ({ ...current, name })),
        setPhone: (phone) => setValues((current) => ({ ...current, phone })),
        setMessage: (message) => setValues((current) => ({ ...current, message })),
        submit: () => {
            setStatus("idle")
            send.trigger({
                siteKey,
                name: values.name,
                phone: values.phone,
                message: values.message,
                pagePath: window.location.pathname,
                device: window.matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop",
                visitor: websiteVisitorId(siteKey),
                submissionId: crypto.randomUUID(),
            })
                .then(() => {
                    setStatus("sent")
                    setValues(EMPTY)
                })
                .catch((error: unknown) => setStatus(STATUS_OF[graphQLErrorCode(error) ?? ""] ?? "failed"))
        },
        again: () => setStatus("idle"),
    }
}
