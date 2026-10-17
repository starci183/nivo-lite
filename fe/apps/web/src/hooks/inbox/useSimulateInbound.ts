"use client"

import {
    QUERY_INBOUND_EVENTS_SWR_KEY,
    useMutateSimulateInboundSwr,
    useQueryInboundSimulationStatusSwr,
} from "@/hooks/swr"
import type { InboundSimulationStatusType, MutateSimulateInboundRequest, SimulateInboundType } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { mutate } from "swr"
import { errorMessage } from "./inbox.shared"

/** The delivery the person just sent: which workspace it went to, its receipt and how many times it was sent. */
interface Submission {
    readonly workspaceId: string
    readonly receipt: SimulateInboundType
    readonly delivery: number
}

/** Queues simulated department work, polls it and toasts each terminal result once. */
export const useSimulateInbound = () => {
    const t = useTranslations("inbox")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { trigger, isMutating, error: mutationError } = useMutateSimulateInboundSwr()
    const [submission, setSubmission] = useState<Submission>()
    const deliveryCount = useRef(0)
    const notified = useRef<string | undefined>(undefined)
    const current = submission?.workspaceId === activeWorkspaceId ? submission : undefined
    const revalidateInbox = useCallback(
        () => mutate((key) => Array.isArray(key) && key[0] === QUERY_INBOUND_EVENTS_SWR_KEY),
        [],
    )
    const settled = (status: InboundSimulationStatusType) => {
        if (current === undefined) return
        const notificationId = `${current.workspaceId}:${current.receipt.id}:${current.delivery}`
        if (notified.current === notificationId) return
        notified.current = notificationId
        if (status.status === "failed") toast.danger(t("simulationFailed"))
        else
            toast.success(
                current.receipt.duplicate
                    ? t("resultDuplicate", { n: status.event.duplicateCount })
                    : t("resultReceived"),
            )
        void revalidateInbox()
    }
    const { data: status, error: statusError } = useQueryInboundSimulationStatusSwr(
        current?.workspaceId ?? "",
        current?.receipt.id,
        current?.delivery ?? 0,
        settled,
    )
    const simulate = useCallback(
        async (request: MutateSimulateInboundRequest) => {
            if (activeWorkspaceId === undefined) return
            setSubmission(undefined)
            const receipt = await runGraphQL(() => trigger(request), { successMessage: t("simulationQueued") })
            if (receipt === undefined) return
            deliveryCount.current += 1
            setSubmission({ workspaceId: activeWorkspaceId, receipt, delivery: deliveryCount.current })
            void revalidateInbox()
        },
        [activeWorkspaceId, revalidateInbox, runGraphQL, t, trigger],
    )

    const queueStatus = status?.status ?? current?.receipt.status
    return {
        simulate,
        status,
        duplicate: current?.receipt.duplicate ?? false,
        isPending: isMutating || queueStatus === "queued" || queueStatus === "running",
        failure: status?.status === "failed" ? t("simulationFailed") : errorMessage(mutationError ?? statusError),
        clearResult: () => setSubmission(undefined),
    }
}
