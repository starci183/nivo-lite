"use client"

import { readField, terminalJobOptions } from "@/hooks/workspaceread"
import type { JobStatusCallbacks, WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { queryVideoRenderStatus } from "@/modules/api/graphql/queries/query-video-render-status"
import type { VideoRenderStatusType } from "@/modules/api"

/** The SWR key of the videoRenderStatus query. */
export const QUERY_VIDEO_RENDER_STATUS_SWR_KEY = "QUERY_VIDEO_RENDER_STATUS_SWR"

/** What the reader of a job wants to hear: each answer of the status, and a failed read. */
type VideoRenderStatusCallbacks = JobStatusCallbacks<VideoRenderStatusType>

/** A queued render, read every two seconds until it is done. */
export const useQueryVideoRenderStatusSwr = (id: string | undefined, callbacks: VideoRenderStatusCallbacks) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_RENDER_STATUS_SWR_KEY, id ? ([id] as const) : null),
        ([name, , id]: WorkspaceReadKey<string>) =>
            readField(queryVideoRenderStatus, { id }, "videoRenderStatus", name),
        terminalJobOptions(callbacks, 2000),
    )
