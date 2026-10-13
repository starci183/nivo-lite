import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { monthRange, vietnamClock, type ContentFigures } from "@/modules/content"

const DAY_MS = 86_400_000

/** The four numbers of the dashboard ribbon, counted in the database. A post counts as published when every channel is marked posted. */
export const readContentFigures = async (workspaceId: string): Promise<DbOutcome<ContentFigures>> => {
    const client = await createServerDbClient()
    const now = new Date()
    const here = vietnamClock(now)
    const month = monthRange(here.y, here.m)
    const [waiting, published, next, pillars, used] = await Promise.all([
        client
            .from("content_items")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "waiting_approval"),
        client
            .from("content_items")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "published")
            .gte("published_at", new Date(now.getTime() - 30 * DAY_MS).toISOString()),
        client
            .from("content_items")
            .select("title, scheduled_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "approved")
            .gte("scheduled_at", now.toISOString())
            .order("scheduled_at", { ascending: true })
            .limit(1),
        client.from("content_pillars").select("id").eq("workspace_id", workspaceId).eq("active", true),
        client
            .from("content_items")
            .select("pillar_id")
            .eq("workspace_id", workspaceId)
            .neq("status", "skipped")
            .not("pillar_id", "is", null)
            .gte("scheduled_at", month.from)
            .lt("scheduled_at", month.to)
            .limit(2000),
    ])
    if ([waiting, published, next, pillars, used].some((result) => result.error !== null)) {
        return dbFailure("unavailable", "figures")
    }
    const activeIds = (pillars.data ?? []).map((p) => p.id)
    const usedIds = new Set((used.data ?? []).map((i) => i.pillar_id))
    const first = (next.data ?? [])[0]
    return dbOk({
        awaitingApproval: waiting.count ?? 0,
        published30: published.count ?? 0,
        next: first?.scheduled_at ? { at: first.scheduled_at, title: first.title } : null,
        pillars: { covered: activeIds.filter((id) => usedIds.has(id)).length, total: activeIds.length },
    })
}
