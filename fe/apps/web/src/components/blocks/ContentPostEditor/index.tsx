"use client"

import { contentEditorEvents, buildContentPostEditorState } from "@/components/composites/ContentEditorAssets"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    channelLabel,
    CONTENT_CHANNELS,
    channelLimits,
    channelOptions,
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
    useContentFocus,
    warningMessage,
    useContentEditorActions,
    useContentFocusedItem,
    toContentDraftWarnings,
    useRequestContentDraft,
    type ChannelWarning,
    type ContentChannel,
    type ContentT,
} from "@/hooks/content"
import { useContentEditorForm } from "@/hooks/rhf"
import { ContentPostEditorBase } from "./component"

/** What the page tells the post editor. */
interface ContentPostEditorProps {
    /** The post named by `?focus=` (its id, or the id of its decision). */
    readonly focus: string | null
}

const keyOf = (index: number): string => String(index)

const warningLines = (t: ContentT, list: ReadonlyArray<ChannelWarning>): Array<string> => [
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

/**
 * The post editor, opened by `?focus=<post id>`: an idea or draft is editable, the rest is read-only. Once approved it shows the
 * copy-ready text, the downloads and "mark posted". Changes use GraphQL; AI drafts poll their queued job until it finishes.
 */
/** Connects the state and commands used by ContentPostEditor. */

/** Draws the connected view from its current state. */
export const ContentPostEditor = (props: ContentPostEditorProps) => {
    const { data, item } = useContentFocusedItem(props.focus)
    const t = useTranslations("content")
    const command = useContentCommand()
    const focus = useContentFocus()
    const state = useContentEditorForm(item)
    const [tab, setTab] = useState<ContentChannel>(item.channels[0] ?? "facebook")
    const [isLibraryOpen, setLibraryOpen] = useState(false)
    const [warnings, setWarnings] = useState<ReadonlyArray<ChannelWarning>>([])
    const [isDeleteOpen, setDeleteOpen] = useState(false)
    const draft = useRequestContentDraft((done) => {
        setWarnings(toContentDraftWarnings(done.warnings))
        command.say("ok", t("draftReady", { s: done.seconds ?? 0 }))
    })
    const actions = useContentEditorActions(async (id, requestHint) => ({
        kind: (await draft.request(id, requestHint)) === undefined ? "handled" : "ok",
    }))
    const isPending = command.isPending || draft.isPending
    const busy = draft.isPending ? "draft" : command.busy
    const commands = useContentEditorCommands({
        item: item,
        actions,
        state,
        command,
        onClose: focus.close,
    })

    const connected = buildContentPostEditorState(
        {
            state,
            tab,
            t,
            data,
            item,
            isPending,
            busy,
            command,
            isLibraryOpen,
            warnings,
            isDeleteOpen,
            focus,
            setTab,
            setLibraryOpen,
            commands,
            setDeleteOpen,
        },
        { channels: CONTENT_CHANNELS, channelLimits, mediaTile, postView, claimWarnings },
    )
    if (connected === null) return null

    return (
        <ContentPostEditorBase
            props={contentPostEditorProps(connected)}
            on={contentEditorEvents(connected, CONTENT_CHANNELS)}
        />
    )
}

/** Builds the props supplied to ContentPostEditorBase. */
const contentPostEditorProps = (
    connected: NonNullable<ReturnType<typeof buildContentPostEditorState>>,
): Parameters<typeof ContentPostEditorBase>[0]["props"] => {
    const {
        t,
        item,
        form,
        data,
        view,
        active,
        limits,
        tile,
        library,
        isPending,
        busy,
        state,
        command,
        isLibraryOpen,
        warnings,
        live,
        isDeleteOpen,
    } = connected
    return {
        t,
        item,
        form,
        pillars: data.pillars,
        statusLabel: view.statusLabel,
        tone: view.tone,
        channelOptions: channelOptions(t),
        tabs: form.channels.map((c) => ({ id: c, label: channelLabel(t, c) })),
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
        isPending,
        busy,
        note: state.error === undefined ? command.note : { tone: "error", text: state.error },
        hint: form.hint,
        isLibraryOpen,
        proof: form.proof,
        warnings: warningLines(t, [...warnings, ...live]),
        isDeleteOpen,
        missingText: form.channels.some((c) => (form.variants[c]?.text ?? "").trim() === ""),
        hasDraftText: Object.values(item.variants).some((v) => v !== undefined && v.text !== ""),
    }
}

/** Builds the on supplied to ContentPostEditorBase. */
