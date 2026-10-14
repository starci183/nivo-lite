"use client"

import type { SWRConfiguration } from "swr"
import { queryVideoRenderStatus } from "@/modules/api/graphql/queries/query-video-render-status"
import { useWorkspaceJobSwr } from "@/hooks/reuseables"
import type { VideoRenderStatusType } from "@/modules/api"

/** The SWR key of the videoRenderStatus query. */
export const QUERY_VIDEO_RENDER_STATUS_SWR_KEY = "QUERY_VIDEO_RENDER_STATUS_SWR"

/** What the reader of a job wants to hear: each answer of the status, and a failed read. */
type VideoRenderStatusCallbacks = Pick<SWRConfiguration<VideoRenderStatusType, Error>, "onSuccess" | "onError">

/** A queued render, read every two seconds until it is done. */
export const useQueryVideoRenderStatusSwr = (id: string | undefined, callbacks: VideoRenderStatusCallbacks) =>
    useWorkspaceJobSwr(QUERY_VIDEO_RENDER_STATUS_SWR_KEY, id, queryVideoRenderStatus, "videoRenderStatus", callbacks)
