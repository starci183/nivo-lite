import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate } from "swr"
import { useMutateDraftLeadExecutionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDraftLeadExecutionSwr"
import { useQueryLeadActionStatusSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadActionStatusSwr"
import { QUERY_RESPONSIBILITIES_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryResponsibilitiesSwr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The action that is being written: its id and the responsibility it drafts for. */
interface Drafting {
    readonly actionId: string
    readonly responsibilityId: string
}

const ENDED = ["succeeded", "failed"]

/**
 * Asks the owning agent to draft the next message of a responsibility. The back end queues the work; the status is polled
 * until it ends, then the board is read again (the responsibility now waits for approval) and the outcome is toasted.
 */
export const useDraftExecution = () => {
    const t = useTranslations("responsibilities")
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateDraftLeadExecutionSwr()
    const [starting, setStarting] = useState<string | null>(null)
    const [drafting, setDrafting] = useState<Drafting | null>(null)
    useQueryLeadActionStatusSwr(drafting === null ? null : { id: drafting.actionId }, {
        refreshInterval: (data) => (data !== undefined && ENDED.includes(data.status) ? 0 : 2000),
        onSuccess: (data) => {
            if (!ENDED.includes(data.status)) return
            const failure = data.status === "failed" ? new Error(t("draftFailed")) : null
            void runGraphQL(
                async () => {
                    if (failure !== null) throw failure
                    await mutate(QUERY_RESPONSIBILITIES_SWR_KEY)
                },
                { successMessage: t("draftReady") },
            )
            setDrafting(null)
        },
    })
    const draft = useCallback(
        async (responsibilityId: string): Promise<void> => {
            setStarting(responsibilityId)
            const queued = await runGraphQL(() => trigger({ responsibilityId }), { successMessage: t("draftQueued") })
            setStarting(null)
            if (queued !== undefined) setDrafting({ actionId: queued.id, responsibilityId })
        },
        [runGraphQL, trigger, t],
    )
    return { draft, draftingId: starting ?? drafting?.responsibilityId ?? null }
}
