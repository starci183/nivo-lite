"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { resolveBotToken } from "@/lib/channels"
import { engineCtx } from "@/lib/flow-ctx"
import { approveVideo } from "@/lib/module-video-work"
import { deciderOf } from "@/lib/permissions"
import { telegramSend } from "@/lib/telegram"
import { isRecord, isUuid } from "@/modules/video"
import type { ProjectView, ShareResult } from "@/modules/video"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readProjectRow } from "./read-project-row"
import { readProject } from "./read-projects"
import { signShareUrl } from "./read-render-urls"
import { readManagerScope } from "./read-scope"
import { writeEvidence } from "./write-evidence"

/** The owner approves a finished video: the request goes through the publish_video gate and the click is the decision. */
export const approveVideoProject = async (id: unknown): Promise<DbOutcome<ProjectView>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    if (!isUuid(id)) return dbFailure("invalid", "project-id")
    try {
        const ctx = await engineCtx()
        await approveVideo(ctx, id, deciderOf(ctx.session.member))
    } catch {
        return dbFailure("invalid", "approve-refused")
    }
    revalidatePath("/", "layout")
    return readProject(scope.value.workspaceId, id)
}

/** Writes a line in Office from NIVO, and to the owner chat on Telegram when a Telegram connection records one. */
const notifyOwner = async (workspaceId: string, text: string): Promise<ShareResult> => {
    const client = await createServerDbClient()
    const office = await client
        .from("messages")
        .insert({ workspace_id: workspaceId, author_kind: "system", author_name: "NIVO", agent_id: null, body: text })
    const connections = toOutcome(
        await client
            .from("connections")
            .select("id, public_meta")
            .eq("workspace_id", workspaceId)
            .eq("provider", "telegram")
            .eq("status", "connected"),
    )
    const chats = connections.kind === "ok" ? connections.value : []
    const sendTo = async (connectionId: string, meta: unknown): Promise<boolean> => {
        const chatId = isRecord(meta) && typeof meta.owner_chat_id === "string" ? meta.owner_chat_id : null
        if (chatId === null) return false
        const token = await resolveBotToken(workspaceId, connectionId)
        if (token === null) return false
        try {
            await telegramSend(token, chatId, text)
            return true
        } catch {
            return false
        }
    }
    const sent = await Promise.all(chats.map((chat) => sendTo(chat.id, chat.public_meta)))
    return { office: office.error === null, telegram: sent.some(Boolean) }
}

/** Shares an approved video with the owner through Office (and Telegram when connected): a link that works for 3 days. */
export const shareVideoProject = async (id: unknown): Promise<DbOutcome<ShareResult>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    if (!isUuid(id)) return dbFailure("invalid", "project-id")
    const client = await createServerDbClient()
    const found = await readProjectRow(client, scope.value.workspaceId, id)
    if (found.kind !== "ok") return found
    if (found.value.status !== "approved" && found.value.status !== "published") {
        return dbFailure("invalid", "not-approved")
    }
    if (found.value.render_id === null) return dbFailure("invalid", "no-render")
    const render = toOutcome(
        await client.from("video_renders").select("output_path").eq("id", found.value.render_id).maybeSingle(),
    )
    if (render.kind !== "ok" || render.value.output_path === null) return dbFailure("invalid", "no-render")
    const url = await signShareUrl(client, render.value.output_path)
    if (url === null) return dbFailure("unavailable", "share-link")
    const t = await getTranslations("video")
    const result = await notifyOwner(scope.value.workspaceId, t("shareMessage", { title: found.value.title, url }))
    await writeEvidence(client, scope.value.workspaceId, {
        kind: "video.shared",
        actor: scope.value.actor,
        summary: t(result.telegram ? "evidenceSharedTelegram" : "evidenceShared", {
            actor: scope.value.actor,
            title: found.value.title,
        }),
    })
    return dbOk(result)
}
