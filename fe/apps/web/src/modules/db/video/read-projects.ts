import "server-only"

import { getTranslations } from "next-intl/server"
import { LIBRARY_LIMIT } from "@/modules/video"
import type { ProjectView } from "@/modules/video"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { signRenderUrls } from "./read-render-urls"
import { PROJECT_COLUMNS, projectViewOf } from "./video.mapper"
import type { ErrorText, ProjectRow, RenderRow, RenderUrls } from "./video.mapper"

const NO_URLS: RenderUrls = { videoUrl: null, downloadUrl: null, posterUrl: null }

/** The resolver of stored error codes in the reader language. */
const errorResolver = async (): Promise<ErrorText> => {
    const t = await getTranslations("video")
    return (code) => (t.has(`lastError_${code}`) ? t(`lastError_${code}`) : t("lastError_unknown"))
}

const viewsOf = async (
    rows: ReadonlyArray<ProjectRow>,
    renders: ReadonlyArray<RenderRow>,
): Promise<ReadonlyArray<ProjectView>> => {
    const resolve = await errorResolver()
    const client = await createServerDbClient()
    const byId = new Map(renders.map((render) => [render.id, render]))
    const now = Date.now()
    return Promise.all(
        rows.map(async (row) => {
            const render = row.render_id === null ? null : (byId.get(row.render_id) ?? null)
            const urls = render === null ? NO_URLS : await signRenderUrls(client, render, row.title)
            return projectViewOf(row, render, urls, resolve, now)
        }),
    )
}

/** Reads the library of a workspace (newest first, without archived videos) under RLS. */
export const readProjects = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<ProjectView>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("video_projects")
            .select(PROJECT_COLUMNS)
            .eq("workspace_id", workspaceId)
            .neq("status", "archived")
            .order("updated_at", { ascending: false })
            .limit(LIBRARY_LIMIT),
    )
    if (rows.kind !== "ok") return rows
    const ids = rows.value.flatMap((row) => (row.render_id === null ? [] : [row.render_id]))
    if (ids.length === 0) return dbOk(await viewsOf(rows.value, []))
    const renders = toOutcome(
        await client.from("video_renders").select("*").eq("workspace_id", workspaceId).in("id", ids),
    )
    if (renders.kind !== "ok") return renders
    return dbOk(await viewsOf(rows.value, renders.value))
}

/** Reads one project with its current render under RLS. */
export const readProject = async (workspaceId: string, id: string): Promise<DbOutcome<ProjectView>> => {
    const client = await createServerDbClient()
    const row = toOutcome(
        await client
            .from("video_projects")
            .select(PROJECT_COLUMNS)
            .eq("workspace_id", workspaceId)
            .eq("id", id)
            .maybeSingle(),
    )
    if (row.kind !== "ok") return row
    const renderId = row.value.render_id
    if (renderId === null) return singleOf(await viewsOf([row.value], []))
    const render = toOutcome(await client.from("video_renders").select("*").eq("id", renderId).maybeSingle())
    if (render.kind !== "ok") return render
    return singleOf(await viewsOf([row.value], [render.value]))
}

const singleOf = (views: ReadonlyArray<ProjectView>): DbOutcome<ProjectView> => {
    const [view] = views
    return view === undefined ? dbFailure("not-found", "project") : dbOk(view)
}
