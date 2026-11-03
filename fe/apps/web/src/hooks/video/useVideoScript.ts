import { useMutateRequestVideoScriptSwr, useQueryVideoScriptStatusSwr } from "@/hooks/swr"
import { useVideoJob } from "./useVideoJob"
import type { VideoOwner } from "./useVideoRefresh"
import type { VideoJobRead } from "./useVideoJob"

type UseVideoScriptResult = {
    request: (projectId: string) => Promise<
        | {
              readonly id: string
          }
        | undefined
    >
    status:
        | {
              errorCode: string | null
              id: string
              progress: number
              projectId: string
              resultId: string | null
              status: string
          }
        | undefined
    error: unknown
    read: VideoJobRead<{
        errorCode: string | null
        id: string
        progress: number
        projectId: string
        resultId: string | null
        status: string
    }>
    isStatusEnabled: boolean
    isPending: boolean
}

/** Queues script generation and follows its status until the job finishes. */
export const useVideoScript = (owner?: VideoOwner): UseVideoScriptResult => {
    const mutation = useMutateRequestVideoScriptSwr()
    const job = useVideoJob({
        trigger: mutation.trigger,
        ...(owner === undefined ? {} : { owner }),
        useStatus: useQueryVideoScriptStatusSwr,
        doneStates: ["succeeded", "failed"],
        successKey: "saved",
        failureFallback: "default",
        queuedKey: "scripting",
    })
    return job
}
