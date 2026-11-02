"use client"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    useContentCommand,
    useContentEditorCommands,
    useContentFocus,
    useContentEditorActions,
    toContentDraftWarnings,
    useRequestContentDraft,
} from "@/hooks/content"
import type { ChannelWarning, ContentChannel } from "@/hooks/content"
import { useContentEditorForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useContentEditorFields } from "@/hooks/contentEditorView"
import type { ContentViewInput } from "./contentWorkbench.shared"

/** Owns the keyed focus editor's real selection, forms, dialogs and AI job lifetime. */
export const useContentPostEditorView = (input: ContentViewInput) => {
    const item =
        input.isActive && input.isReady
            ? (input.data?.items.find((item) => item.id === input.focus || item.work_item_id === input.focus) ?? null)
            : null
    const scope = JSON.stringify([input.scope, input.focus])
    const isActive = input.isActive && item !== null
    const t = useTranslations("content")
    const lifetime = useFeatureLifetime(isActive, scope)
    const command = useContentCommand(isActive, scope)
    const focus = useContentFocus()
    const state = useContentEditorForm(item, { isActive, scope })
    const [tab, setTab] = useState<ContentChannel>(item?.channels[0] ?? "facebook")
    const [isLibraryOpen, setLibraryOpen] = useState(false)
    const [warnings, setWarnings] = useState<ReadonlyArray<ChannelWarning>>([])
    const [isDeleteOpen, setDeleteOpen] = useState(false)
    useFeatureReset({
        isActive,
        isReady: item !== null,
        scope,
        onReset: () => {
            setTab(item?.channels[0] ?? "facebook")
            setLibraryOpen(false)
            setWarnings([])
            setDeleteOpen(false)
        },
    })
    const draft = useRequestContentDraft(
        (done) => {
            setWarnings(toContentDraftWarnings(done.warnings))
            command.say("ok", t("draftReady", { s: done.seconds ?? 0 }))
        },
        isActive,
        scope,
    )
    const actions = useContentEditorActions(async (id, requestHint) => ({
        kind: (await draft.request(id, requestHint)) === undefined ? "handled" : "ok",
    }))
    const commands = useContentEditorCommands({ item, isActive, scope, actions, state, command, onClose: focus.close })
    return useContentEditorFields({
        state,
        tab,
        data: input.data,
        item,
        copy: input.copy,
        capture: lifetime.capture,
        isPending: command.isPending || draft.isPending,
        busy: draft.isPending ? "draft" : command.busy,
        command,
        isLibraryOpen,
        warnings,
        isDeleteOpen,
        focus,
        setTab,
        setLibraryOpen,
        commands,
        setDeleteOpen,
    })
}
