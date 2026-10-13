import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutateRequestVideoScriptSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRequestVideoScriptSwr"
import { useQueryVideoScriptStatusSwr } from "@/hooks/swr/api/graphql/queries/useQueryVideoScriptStatusSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useVideoRefresh } from "./useVideoRefresh"
import { useVideoJobReport } from "./useVideoJobReport"

const SCRIPT_DONE_STATES: ReadonlyArray<string> = ["succeeded", "failed"]

/** The script job being followed and the workspace it was queued in. */
interface VideoScriptJobRef {
    readonly workspaceId: string | undefined
    readonly id: string
}

/** Queues script generation and follows its status until the job finishes. */
export const useVideoScript = () => {
    const t = useTranslations("video")
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useVideoRefresh()
    const { trigger, isMutating } = useMutateRequestVideoScriptSwr()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { reportStatus, reportError } = useVideoJobReport({
        doneStates: SCRIPT_DONE_STATES,
        successKey: "saved",
        failureFallback: "default",
    })
    const [job, setJob] = useState<VideoScriptJobRef>()
    const requestId = job?.workspaceId === activeWorkspaceId ? job?.id : undefined
    const { data: status, error } = useQueryVideoScriptStatusSwr(requestId, {
        onSuccess: (answer) => void reportStatus(answer),
        onError: (failure) => void reportError(failure, requestId),
    })
    const request = async (projectId: string) => {
        const queued = await runGraphQL(() => trigger({ projectId }), { successMessage: t("scripting") })
        if (queued !== undefined) {
            setJob({ workspaceId: activeWorkspaceId, id: queued.id })
            await refresh()
        }
        return queued
    }
    return { request, status, error, isMutating }
}
