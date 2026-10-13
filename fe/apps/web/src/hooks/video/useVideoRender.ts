import { useMutateRequestVideoRenderSwr, useQueryVideoRenderStatusSwr } from "@/hooks/swr"
import { useVideoJob } from "./useVideoJob"

/** Queues a render, follows its status, and reports its terminal outcome once (`initialRenderId`: the render already running). */
export const useVideoRender = (initialRenderId?: string) => {
    const { trigger, isMutating } = useMutateRequestVideoRenderSwr()
    return {
        ...useVideoJob({
            trigger,
            useStatus: useQueryVideoRenderStatusSwr,
            doneStates: ["done", "succeeded", "failed"],
            successKey: "status_ready",
            failureFallback: "render-unavailable",
            queuedKey: "stage_queued",
            initialId: initialRenderId,
        }),
        isMutating,
    }
}
