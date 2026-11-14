"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    QUERY_SANDBOX_CALLS_SWR_KEY,
    QUERY_SANDBOX_LATEST_REQUEST_SWR_KEY,
    QUERY_SANDBOX_NEXT_CASES_SWR_KEY,
    QUERY_SANDBOX_WAITING_RUNS_SWR_KEY,
    useMutateSendSandboxCaseSwr,
    useMutateSetSandboxNextCaseSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshSandbox } from "./sandbox.shared"

/** The lowest status a webhook answers when it refused what the page sent. */
const REFUSED_FROM = 400

/** What a send takes: the case and the inputs the person filled (an input left empty is left out, so the back end prefills it). */
interface SendInput {
    readonly connectionId: string
    readonly caseId: string
    readonly inputs: ReadonlyArray<{ readonly name: string; readonly value: string }>
}

/** The commands on the cases of an account: send an inbound one, choose the next outbound one. */
export interface SandboxCaseCommands {
    readonly send: (input: SendInput) => Promise<boolean>
    readonly choose: (connectionId: string, caseId: string) => Promise<boolean>
    /** The case being sent, or chosen; null when none is. */
    readonly sendingId: string | null
    readonly choosingId: string | null
}

/** Sends cases and chooses next cases through the back end, toasted in plain words; a webhook that refused the send is named in a warning. */
export const useSandboxCaseCommands = (): SandboxCaseCommands => {
    const t = useTranslations("sandbox")
    const run = useGraphQLWithToast()
    const sending = useMutateSendSandboxCaseSwr()
    const choosing = useMutateSetSandboxNextCaseSwr()
    const [sendingId, setSendingId] = useState<string | null>(null)
    const [choosingId, setChoosingId] = useState<string | null>(null)
    return {
        send: async (input) => {
            setSendingId(input.caseId)
            try {
                const answer = await run(() => sending.trigger({ ...input, inputs: [...input.inputs] }), {
                    successMessage: t("toastSent", { id: input.caseId }),
                })
                if (answer === undefined) return false
                const refused = answer.deliveries.find((delivery) => delivery.status >= REFUSED_FROM)
                if (refused !== undefined) {
                    toast.warning(t("toastRefused", { status: refused.status, path: refused.path }))
                }
                await refreshSandbox(
                    QUERY_SANDBOX_CALLS_SWR_KEY,
                    QUERY_SANDBOX_LATEST_REQUEST_SWR_KEY,
                    QUERY_SANDBOX_WAITING_RUNS_SWR_KEY,
                )
                return true
            } finally {
                setSendingId(null)
            }
        },
        choose: async (connectionId, caseId) => {
            setChoosingId(caseId)
            try {
                const answer = await run(() => choosing.trigger({ connectionId, caseId }), {
                    successMessage: t("toastChosen", { id: caseId }),
                })
                if (answer === undefined) return false
                await refreshSandbox(QUERY_SANDBOX_NEXT_CASES_SWR_KEY)
                return true
            } finally {
                setChoosingId(null)
            }
        },
        sendingId,
        choosingId,
    }
}
