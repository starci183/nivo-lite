"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { PublishProof } from "@/components/leaves/ContentEditorPublish"
import {
    CHANNEL_OPTIONS,
    CONTENT_CHANNELS,
    channelLimits,
    channelRule,
    claimWarnings,
    dateText,
    dateTimeText,
    downloadFiles,
    historyRows,
    mediaTile,
    postView,
    publishSteps,
    useContentCommand,
    useContentEditorCommands,
    useContentEditorForm,
    useContentFocus,
    warningMessage,
    type ChannelWarning,
    type ContentChannel,
    type ContentItem,
    type ContentT,
    type ContentWorkbenchData,
    type MediaRef,
    type EditorActions,
} from "@/hooks/content"
import { writeDraftItem } from "@/modules/db/content-ai/write-draft"
import { writeMediaUpload } from "@/modules/db/content/write-media"
import { writeSaveItem, writeTransitionItem } from "@/modules/db/content/write-items"
import { writeMarkPublished, writeSubmitForApproval } from "@/modules/db/content/write-publish"
import { ContentPostEditorBase } from "./component"

/** Props of {@link ContentPostEditor}. */
export interface ContentPostEditorProps {
    /** The post to edit. */
    readonly item: ContentItem
    /** What the workbench read for the member: the lists and URLs the editor offers. */
    readonly data: ContentWorkbenchData
}

const ACTIONS: EditorActions = {
    saveItem: writeSaveItem,
    draftItem: writeDraftItem,
    submitForApproval: writeSubmitForApproval,
    transitionItem: writeTransitionItem,
    markPublished: writeMarkPublished,
    uploadMedia: writeMediaUpload,
}

const keyOf = (index: number): string => String(index)

const warningLines = (t: ContentT, list: ReadonlyArray<ChannelWarning>): Array<string> => [
    ...new Set(
        list.map((w) => {
            const message = warningMessage(w.warning)
            return t("claimWithChannel", {
                channel: channelRule(w.channel).label,
                message: t(message.key, message.values),
            })
        }),
    ),
]

/**
 * The post editor, opened by `?focus=<post id>`: an idea or draft is editable, the rest is read-only. Once approved it shows the
 * copy-ready text, the downloads and "mark posted". Every change is saved through Server Actions; nothing is ever posted from here.
 */
export const ContentPostEditor = (props: ContentPostEditorProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const focus = useContentFocus()
    const state = useContentEditorForm(props.item)
    const [tab, setTab] = useState<ContentChannel>(props.item.channels[0] ?? "facebook")
    const [hint, setHint] = useState("")
    const [isLibraryOpen, setLibraryOpen] = useState(false)
    const [proof, setProof] = useState<Record<string, PublishProof | undefined>>({})
    const [warnings, setWarnings] = useState<ReadonlyArray<ChannelWarning>>([])
    const [isDeleteOpen, setDeleteOpen] = useState(false)
    const commands = useContentEditorCommands({
        item: props.item,
        actions: ACTIONS,
        state,
        command,
        onClose: focus.close,
        onWarnings: setWarnings,
    })
    const { form, patch } = state
    const withChannel = (id: string, run: (channel: ContentChannel) => void): void => {
        const found = CONTENT_CHANNELS.find((c) => c === id)
        if (found !== undefined) run(found)
    }
    const { data, item } = props
    const active = form.channels.includes(tab) ? tab : (form.channels[0] ?? "facebook")
    const limits = channelLimits(active)
    const tile = (m: MediaRef) => mediaTile(m, data.urls)
    const library = data.library.filter((m) => !form.media.some((x) => x.path === m.path))
    const view = postView(t, item, {})
    const live = form.channels.flatMap((channel) =>
        claimWarnings(form.variants[channel]?.text ?? "").map((warning) => ({ channel, warning })),
    )
    return (
        <ContentPostEditorBase
            props={{
                t,
                item,
                form,
                pillars: data.pillars,
                statusLabel: view.statusLabel,
                tone: view.tone,
                channelOptions: CHANNEL_OPTIONS,
                tabs: form.channels.map((c) => ({ id: c, label: channelRule(c).label })),
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
                          },
                media: form.media.map(tile),
                library: library.map(tile),
                linkRows: form.links.map((l, i) => ({ key: keyOf(i), url: l.url, label: l.label })),
                steps: publishSteps(t, item),
                files: downloadFiles(form.media, data.urls),
                history: historyRows(item.evidence),
                videos: data.videos
                    .filter((v) => !form.media.some((m) => m.id === v.id))
                    .map((v) => ({ id: v.id, label: `${v.name} · ${dateText(v.createdAt)}` })),
                scheduledText: dateTimeText(item.scheduled_at),
                isEditable: (item.status === "idea" || item.status === "draft") && data.canManage,
                canManage: data.canManage,
                isPending: command.isPending,
                busy: command.busy,
                note: command.note,
                hint,
                isLibraryOpen,
                proof,
                warnings: warningLines(t, [...warnings, ...live]),
                isDeleteOpen,
                missingText: form.channels.some((c) => (form.variants[c]?.text ?? "").trim() === ""),
                hasDraftText: Object.values(item.variants).some((v) => v !== undefined && v.text !== ""),
            }}
            on={{
                close: focus.close,
                dismissNote: command.dismiss,
                patch,
                channels: (values) => patch({ channels: CONTENT_CHANNELS.filter((c) => values.includes(c)) }),
                tab: (id) => {
                    const next = CONTENT_CHANNELS.find((c) => c === id)
                    if (next !== undefined) setTab(next)
                },
                text: (text) => state.setVariant(active, { text }),
                note: (note) => state.setVariant(active, { note }),
                tags: (text) => state.setTags(active, text),
                hint: setHint,
                toggleLibrary: () => setLibraryOpen((open) => !open),
                attach: (key) => {
                    const found = library.find((m) => tile(m).key === key)
                    if (found !== undefined) commands.attach(found)
                },
                attachVideo: (id) => {
                    const video = data.videos.find((v) => v.id === id)
                    if (video !== undefined) commands.attach({ kind: "video_render", id: video.id, name: video.name })
                },
                removeMedia: (key) => patch({ media: form.media.filter((m) => tile(m).key !== key) }),
                upload: commands.upload,
                link: (key, change) =>
                    patch({ links: form.links.map((l, i) => (keyOf(i) === key ? { ...l, ...change } : l)) }),
                addLink: () => patch({ links: [...form.links, { url: "", label: "" }] }),
                removeLink: (key) => patch({ links: form.links.filter((_, i) => keyOf(i) !== key) }),
                proof: (channel, change) =>
                    setProof((cur) => ({ ...cur, [channel]: { url: "", how: "", ...cur[channel], ...change } })),
                copy: (channel) => withChannel(channel, commands.copy),
                mark: (channel) => withChannel(channel, (c) => commands.markPosted(c, proof[c])),
                save: commands.save,
                draft: () => commands.draft(hint),
                submit: commands.submit,
                transition: commands.transition,
                deleteOpen: setDeleteOpen,
            }}
        />
    )
}
