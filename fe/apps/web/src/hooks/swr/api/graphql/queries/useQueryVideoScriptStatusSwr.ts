"use client"

import type { SWRConfiguration } from "swr"
import { queryVideoScriptStatus } from "@/modules/api/graphql/queries/query-video-script-status"
import { useWorkspaceJobSwr } from "@/hooks/reuseables"
import type { VideoScriptStatusType } from "@/modules/api"

/** The SWR key of the videoScriptStatus query. */
export const QUERY_VIDEO_SCRIPT_STATUS_SWR_KEY = "QUERY_VIDEO_SCRIPT_STATUS_SWR"

/** What the reader of a job wants to hear: each answer of the status, and a failed read. */
type VideoScriptStatusCallbacks = Pick<SWRConfiguration<VideoScriptStatusType, Error>, "onSuccess" | "onError">

/** A queued script, read every two seconds until it is done. */
export const useQueryVideoScriptStatusSwr = (id: string | undefined, callbacks: VideoScriptStatusCallbacks) =>
    useWorkspaceJobSwr(QUERY_VIDEO_SCRIPT_STATUS_SWR_KEY, id, queryVideoScriptStatus, "videoScriptStatus", callbacks)
