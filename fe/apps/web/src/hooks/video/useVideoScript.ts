import { useMutateRequestVideoScriptSwr, useQueryVideoScriptStatusSwr } from "@/hooks/swr"
import { useVideoJob } from "./useVideoJob"
import type { VideoOwner } from "./useVideoRefresh"

/** Queues script generation and follows its status until the job finishes. */
export const useVideoScript = (owner?: VideoOwner) => {
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
