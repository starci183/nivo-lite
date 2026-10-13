"use server"
import "server-only"

import { getFormatter, getLocale, getTranslations } from "next-intl/server"
import {
    EMPTY_INPUTS,
    TARGET_SECONDS_MAX,
    TARGET_SECONDS_MIN,
    goalTemplateOf,
    guardNewProject,
    guardPatch,
    isUuid,
    writeInputs,
    writeScript,
} from "@/modules/video"
import type { Goal, ProjectView } from "@/modules/video"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readProjectRow } from "./read-project-row"
import { readProject } from "./read-projects"
import { readManagerScope } from "./read-scope"
import { writeEvidence } from "./write-evidence"

/** The auto-title of a new video: the goal name and today's day and month. */
const autoTitle = async (goal: Goal): Promise<string> => {
    const locale = await getLocale()
    const format = await getFormatter()
    const label = goalTemplateOf(goal).label[locale === "en" ? "en" : "vi"]
    return `${label} - ${format.dateTime(new Date(), { day: "2-digit", month: "2-digit" })}`
}

/** Creates a draft video project in the workspace of the request (owners and managers). */
export const createVideoProject = async (input: unknown): Promise<DbOutcome<ProjectView>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    const draft = guardNewProject(input)
    if (draft === null) return dbFailure("invalid", "project-input")
    const typed = draft.title ?? ""
    const title = typed === "" ? await autoTitle(draft.goal) : typed
    const client = await createServerDbClient()
    const inserted = toOutcome(
        await client
            .from("video_projects")
            .insert({
                workspace_id: scope.value.workspaceId,
                title,
                goal: draft.goal,
                aspect: draft.aspect,
                target_seconds: Math.min(TARGET_SECONDS_MAX, Math.max(TARGET_SECONDS_MIN, draft.targetSeconds)),
                inputs: writeInputs({ ...EMPTY_INPUTS, ...draft.inputs }),
                script_meta: typed === "" ? { auto_title: true } : {},
                created_by: scope.value.userId,
            })
            .select("id")
            .single(),
    )
    if (inserted.kind !== "ok") return inserted
    const t = await getTranslations("video")
    await writeEvidence(client, scope.value.workspaceId, {
        kind: "video.project_created",
        actor: scope.value.actor,
        summary: t("evidenceCreated", { title, aspect: draft.aspect, seconds: draft.targetSeconds }),
    })
    return readProject(scope.value.workspaceId, inserted.value.id)
}

/** Edits a draft. A video being scripted or rendered is not edited; editing a finished video makes it a draft again. */
export const updateVideoProject = async (id: unknown, patch: unknown): Promise<DbOutcome<ProjectView>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    const edit = guardPatch(patch, scope.value.workspaceId)
    if (!isUuid(id) || edit === null) return dbFailure("invalid", "project-input")
    const client = await createServerDbClient()
    const current = await readProjectRow(client, scope.value.workspaceId, id)
    if (current.kind !== "ok") return current
    if (current.value.status === "scripting" || current.value.status === "rendering") {
        return dbFailure("invalid", "video-busy")
    }
    const reopens = edit.script !== undefined && ["ready", "approved", "published"].includes(current.value.status)
    const updated = toOutcome(
        await client
            .from("video_projects")
            .update({
                ...(edit.title === undefined ? {} : { title: edit.title === "" ? current.value.title : edit.title }),
                ...(edit.goal === undefined ? {} : { goal: edit.goal }),
                ...(edit.aspect === undefined ? {} : { aspect: edit.aspect }),
                ...(edit.targetSeconds === undefined ? {} : { target_seconds: edit.targetSeconds }),
                ...(edit.inputs === undefined ? {} : { inputs: writeInputs(edit.inputs) }),
                ...(edit.script === undefined ? {} : { script: writeScript(edit.script) }),
                ...(reopens ? { status: "draft" } : {}),
            })
            .eq("workspace_id", scope.value.workspaceId)
            .eq("id", id)
            .select("id")
            .maybeSingle(),
    )
    if (updated.kind !== "ok") return updated
    return readProject(scope.value.workspaceId, id)
}

/** Copies a project (title, goal, inputs and script) into a new draft. */
export const duplicateVideoProject = async (id: unknown): Promise<DbOutcome<ProjectView>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    if (!isUuid(id)) return dbFailure("invalid", "project-id")
    const client = await createServerDbClient()
    const source = await readProjectRow(client, scope.value.workspaceId, id)
    if (source.kind !== "ok") return source
    const t = await getTranslations("video")
    const inserted = toOutcome(
        await client
            .from("video_projects")
            .insert({
                workspace_id: scope.value.workspaceId,
                title: t("copyTitle", { title: source.value.title }).slice(0, 120),
                goal: source.value.goal,
                aspect: source.value.aspect,
                target_seconds: source.value.target_seconds,
                inputs: source.value.inputs,
                script: source.value.script,
                source_project_id: source.value.id,
                created_by: scope.value.userId,
            })
            .select("id")
            .single(),
    )
    if (inserted.kind !== "ok") return inserted
    await writeEvidence(client, scope.value.workspaceId, {
        kind: "video.project_duplicated",
        actor: scope.value.actor,
        summary: t("evidenceDuplicated", { title: source.value.title }),
    })
    return readProject(scope.value.workspaceId, inserted.value.id)
}

/** Archives a project, or brings it back (ready when it has a render, else a draft). */
export const archiveVideoProject = async (id: unknown, archived: unknown): Promise<DbOutcome<null>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    if (!isUuid(id) || typeof archived !== "boolean") return dbFailure("invalid", "project-input")
    const client = await createServerDbClient()
    const current = await readProjectRow(client, scope.value.workspaceId, id)
    if (current.kind !== "ok") return current
    if (current.value.status === "scripting" || current.value.status === "rendering") {
        return dbFailure("invalid", "video-busy")
    }
    const restored = current.value.render_id === null ? "draft" : "ready"
    const updated = toOutcome(
        await client
            .from("video_projects")
            .update({ status: archived ? "archived" : restored })
            .eq("workspace_id", scope.value.workspaceId)
            .eq("id", id)
            .select("id")
            .maybeSingle(),
    )
    return updated.kind === "ok" ? dbOk(null) : updated
}

/** The owner posted the downloaded file themselves: the only way a video becomes published. */
export const markVideoPublished = async (id: unknown): Promise<DbOutcome<ProjectView>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    if (!isUuid(id)) return dbFailure("invalid", "project-id")
    const client = await createServerDbClient()
    const updated = toOutcome(
        await client
            .from("video_projects")
            .update({ status: "published", published_at: new Date().toISOString() })
            .eq("workspace_id", scope.value.workspaceId)
            .eq("id", id)
            .eq("status", "approved")
            .select("title")
            .maybeSingle(),
    )
    if (updated.kind === "not-found") return dbFailure("invalid", "not-approved")
    if (updated.kind !== "ok") return updated
    const t = await getTranslations("video")
    await writeEvidence(client, scope.value.workspaceId, {
        kind: "video.published_by_owner",
        actor: scope.value.actor,
        summary: t("evidencePublished", { actor: scope.value.actor, title: updated.value.title }),
    })
    return readProject(scope.value.workspaceId, id)
}
