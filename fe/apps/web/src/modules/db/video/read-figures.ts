import "server-only"

import { CREDITS_PER_USD } from "@/lib/usage-shared"
import type { VideoFigures } from "@/modules/video"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

const DAY_MS = 86_400_000
const USAGE_ROW_LIMIT = 5000

/** Reads the figures of the video ribbon: projects by status and the credits the script writer spent in 30 days. */
export const readFigures = async (workspaceId: string): Promise<DbOutcome<VideoFigures>> => {
    const client = await createServerDbClient()
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString()
    const count = (status: string) =>
        client
            .from("video_projects")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", status)
    const [rendering, scripting, ready, approved, published, usage] = await Promise.all([
        count("rendering"),
        count("scripting"),
        count("ready"),
        count("approved"),
        count("published").gte("published_at", since),
        client
            .from("ai_usage_events")
            .select("cost_usd")
            .eq("workspace_id", workspaceId)
            .eq("module", "video")
            .gte("created_at", since)
            .limit(USAGE_ROW_LIMIT),
    ])
    const failed = [rendering, scripting, ready, approved, published, usage].some((result) => result.error !== null)
    if (failed) return dbFailure("unavailable", "figures")
    const usd = (usage.data ?? []).reduce((sum, row) => sum + Number(row.cost_usd), 0)
    return dbOk({
        rendering: rendering.count ?? 0,
        scripting: scripting.count ?? 0,
        readyToPublish: (ready.count ?? 0) + (approved.count ?? 0),
        approved: approved.count ?? 0,
        published30: published.count ?? 0,
        credits30: Math.round(usd * CREDITS_PER_USD),
    })
}
