"use client"
import type { ContentItem, EditorForm, MediaRef } from "@/modules/content"
import { useTranslations } from "next-intl"
import {
    CONTENT_CHANNELS,
    channelLimits,
    mediaTile,
    postView,
    claimWarnings,
    channelOptions,
    channelLabel,
    publishSteps,
    downloadFiles,
    historyRows,
    dateText,
    dateTimeText,
    warningMessage,
    type ContentChannel,
    type ChannelWarning,
} from "@/hooks/content"

import type { ContentEditorItemView, ContentEditorFormView, ContentNoteView, ContentAssembly } from "@/modules/types"

import { contentEditorEvents, type ContentEditorFieldsInput } from "./contentEditorView.shared"

const warningLines = (
    t: ReturnType<typeof useTranslations<"content">>,
    list: ReadonlyArray<ChannelWarning>,
): ReadonlyArray<string> => [
    ...new Set(
        list.map((w) => {
            const message = warningMessage(w.warning)
            return t("claimWithChannel", {
                channel: channelLabel(t, w.channel),
                message: t(message.key, message.values),
            })
        }),
    ),
]

/** Resolves the actual selected post's full details, assets, status and record-specific words. */
export const useContentEditorFields = (input: ContentEditorFieldsInput): ContentAssembly["editorView"] => {
    const t = useTranslations("content")
    const { item, state, data } = input
    const { form, patch } = state
    const withChannel = (id: string, run: (channel: ContentChannel) => void) => {
        const found = CONTENT_CHANNELS.find((c) => c === id)
        if (found !== undefined) run(found)
    }
    const active = form.channels.includes(input.tab) ? input.tab : (form.channels[0] ?? "facebook")
    const limits = channelLimits(t, active)
    const tile = (media: MediaRef) => mediaTile(media, data?.urls ?? {})
    const library = data?.library.filter((media) => !form.media.some((current) => current.path === media.path)) ?? []
    const on = contentEditorEvents({ ...input, patch, active, library, tile, form, withChannel }, CONTENT_CHANNELS)
    if (item === null || data === undefined) return { props: null, on }
    const view = postView(t, item, {})
    const live = form.channels.flatMap((channel) =>
        claimWarnings(form.variants[channel]?.text ?? "").map((warning) => ({ channel, warning })),
    )
    const note: ContentNoteView | null =
        state.error === undefined ? input.command.note : { tone: "error", text: state.error }
    return {
        props: {
            copy: input.copy,
            item: editorItemViewOf(item),
            form: editorFormViewOf(form),
            pillars: data.pillars,
            statusLabel: view.statusLabel,
            tone: view.tone,
            channelOptions: channelOptions(t),
            approvedByLabel: item.approved_by ? t("approvedBy", { who: item.approved_by }) : null,
            history: historyRows(item.evidence),
            scheduledText: dateTimeText(item.scheduled_at),
            isEditable: (item.status === "idea" || item.status === "draft") && data.canManage,
            canManage: data.canManage,
            isPending: input.isPending,
            busy: input.busy,
            note,
            hint: form.hint,
            warnings: warningLines(t, [...input.warnings, ...live]),
            isDeleteOpen: input.isDeleteOpen,
            missingText: form.channels.some((channel) => (form.variants[channel]?.text ?? "").trim() === ""),
            hasDraftText: Object.values(item.variants).some((variant) => variant.text !== ""),
            assets: {
                tabs: form.channels.map((channel) => ({ id: channel, label: channelLabel(t, channel) })),
                openVariant:
                    form.channels.length === 0
                        ? null
                        : {
                              id: active,
                              label: limits.label,
                              text: form.variants[active]?.text ?? "",
                              note: form.variants[active]?.note ?? "",
                              tags: form.tags[active] ?? "",
                              maxChars: limits.maxChars,
                              showTags: limits.showTags,
                              fieldLabel: t("variantFor", { channel: limits.label }),
                              characterLabel: t("variantChars", {
                                  n: (form.variants[active]?.text ?? "").length,
                                  max: limits.maxChars,
                              }),
                          },
                media: form.media.map(tile),
                library: library.map(tile),
                linkRows: form.links.map((link, index) => ({ key: String(index), url: link.url, label: link.label })),
                steps: publishSteps(t, item),
                files: downloadFiles(form.media, data.urls),
                videos: data.videos
                    .filter((video) => !form.media.some((media) => media.id === video.id))
                    .map((video) => ({ id: video.id, label: video.name + " · " + dateText(video.createdAt) })),
                isLibraryOpen: input.isLibraryOpen,
                proof: form.proof,
            },
        },
        on,
    }
}

/** The four original saved-post facts used around the form; private domain fields stay in the world. */
const editorItemViewOf = (item: ContentItem): ContentEditorItemView => ({
    title: item.title,
    status: item.status,
    approved_by: item.approved_by,
    holiday_key: item.holiday_key,
})

/** The six original displayed detail values, separate from private media/proof controller state. */
const editorFormViewOf = (form: EditorForm): ContentEditorFormView => ({
    title: form.title,
    brief: form.brief,
    pillarId: form.pillarId,
    channels: form.channels,
    date: form.date,
    time: form.time,
})
