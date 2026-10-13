import { useMutateRequestVideoScriptSwr, useQueryVideoScriptStatusSwr } from "@/hooks/swr"
import { useVideoJob } from "./useVideoJob"

/** Queues script generation and follows its status until the job finishes. */
export const useVideoScript = () => {
    const mutation = useMutateRequestVideoScriptSwr()
    const job = useVideoJob({
        trigger: mutation.trigger,
        useStatus: useQueryVideoScriptStatusSwr,
        doneStates: ["succeeded", "failed"],
        successKey: "saved",
        failureFallback: "default",
        queuedKey: "scripting",
    })
    return { ...job, isMutating: mutation.isMutating }
}
