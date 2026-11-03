import { useMutateRequestVideoRenderSwr, useQueryVideoRenderStatusSwr } from "@/hooks/swr"
import { useVideoJob } from "./useVideoJob"
import type { VideoOwner } from "./useVideoRefresh"
import type { VideoJobRead } from "./useVideoJob"

type UseVideoRenderResult = {
    request: (projectId: string) => Promise<
        | {
              readonly id: string
          }
        | undefined
    >
    status:
        | {
              durationMs: number | null
              errorCode: string | null
              id: string
              outputPath: string | null
              posterPath: string | null
              progress: number
              sizeBytes: number | null
              stage: string | null
              status: string
          }
        | undefined
    error: unknown
    read: VideoJobRead<{
        durationMs: number | null
        errorCode: string | null
        id: string
        outputPath: string | null
        posterPath: string | null
        progress: number
        sizeBytes: number | null
        stage: string | null
        status: string
    }>
    isStatusEnabled: boolean
    isPending: boolean
}

/** Queues a render, follows its status, and reports its terminal outcome once (`initialRenderId`: the render already running). */
export const useVideoRender = (initialRenderId?: string, owner?: VideoOwner): UseVideoRenderResult => {
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
