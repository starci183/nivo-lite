import { useMutateRequestVideoRenderSwr, useQueryVideoRenderStatusSwr } from "@/hooks/swr"
import { useVideoJob } from "./useVideoJob"
import type { VideoOwner } from "./useVideoRefresh"

/** Queues a render, follows its status, and reports its terminal outcome once (`initialRenderId`: the render already running). */
export const useVideoRender = (initialRenderId?: string, owner?: VideoOwner) => {
    const { trigger } = useMutateRequestVideoRenderSwr()
    return {
        ...useVideoJob({
            trigger,
            ...(owner === undefined ? {} : { owner }),
            useStatus: useQueryVideoRenderStatusSwr,
            doneStates: ["done", "succeeded", "failed"],
            successKey: "status_ready",
            failureFallback: "render-unavailable",
            queuedKey: "stage_queued",
            ...(initialRenderId === undefined ? {} : { initialId: initialRenderId }),
        }),
    }
}
