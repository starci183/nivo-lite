import type { ContentWorkbenchData, ContentItem } from "@/modules/content"
import type { Dispatch, SetStateAction } from "react"
import type {
    ChannelWarning,
    useContentFocus,
    useContentCommand,
    useContentEditorCommands,
    ContentChannel,
    MediaRef,
    EditorForm,
} from "@/hooks/content"
import type { useContentEditorForm } from "@/hooks/rhf"

import type { MediaTile, ContentActions, ContentViews } from "@/modules/types"

/** State and commands consumed by the editor event mapping. */
interface ContentEditorEventsInput {
    readonly capture: () => () => boolean
    readonly focus: ReturnType<typeof useContentFocus>
    readonly state: ReturnType<typeof useContentEditorForm>
    readonly command: ReturnType<typeof useContentCommand>
    readonly patch: ReturnType<typeof useContentEditorForm>["patch"]
    readonly setTab: Dispatch<SetStateAction<ContentChannel>>
    readonly active: ContentChannel
    readonly setLibraryOpen: Dispatch<SetStateAction<boolean>>
    readonly library: ReadonlyArray<MediaRef>
    readonly tile: (media: MediaRef) => MediaTile
    readonly commands: ReturnType<typeof useContentEditorCommands>
    readonly data: ContentWorkbenchData | undefined
    readonly form: EditorForm
    readonly withChannel: (id: string, run: (channel: ContentChannel) => void) => void
    readonly setDeleteOpen: Dispatch<SetStateAction<boolean>>
}

/** Maps editor interactions to the injected form and command state. */
export const contentEditorEvents = (
    connected: ContentEditorEventsInput,
    channels: ReadonlyArray<ContentChannel>,
): ContentActions["editorActions"] => {
    const {
        focus,
        state,
        command,
        patch,
        setTab,
        active,
        setLibraryOpen,
        library,
        tile,
        commands,
        data,
        form,
        withChannel,
        setDeleteOpen,
    } = connected
    return {
        close: focus.close,
        dismissNote: () => {
            state.dismissError()
            command.dismiss()
        },
        patch,
        channels: (values) => patch({ channels: channels.filter((c) => values.includes(c)) }),
        tab: (id) => {
            const next = channels.find((c) => c === id)
            if (next !== undefined) setTab(next)
        },
        text: (text) => state.setVariant(active, { text }),
        note: (note) => state.setVariant(active, { note }),
        tags: (text) => state.setTags(active, text),
        hint: (hint) => patch({ hint }),
        toggleLibrary: () => setLibraryOpen((open) => !open),
        attach: (key) => {
            const found = library.find((m) => tile(m).key === key)
            if (found !== undefined) commands.attach(found)
        },
        attachVideo: (id) => {
            const video = data?.videos.find((v) => v.id === id)
            if (video !== undefined) commands.attach({ kind: "video_render", id: video.id, name: video.name })
        },
        removeMedia: (key) => patch({ media: form.media.filter((m) => tile(m).key !== key) }),
        upload: commands.upload,
        link: (key, change) =>
            patch({ links: form.links.map((l, i) => (String(i) === key ? { ...l, ...change } : l)) }),
        addLink: () => patch({ links: [...form.links, { url: "", label: "" }] }),
        removeLink: (key) => patch({ links: form.links.filter((_, i) => String(i) !== key) }),
        proof: (channel, change) =>
            withChannel(channel, (id) =>
                patch({
                    proof: { ...form.proof, [id]: { url: "", how: "", ...form.proof[id], ...change } },
                }),
            ),
        copy: (channel) => withChannel(channel, commands.copy),
        mark: (channel) =>
            withChannel(channel, (id) => {
                const isCurrent = connected.capture()
                state.validateProof(id).then((valid) => {
                    if (valid && isCurrent()) commands.markPosted(id, form.proof[id])
                })
            }),
        save: commands.save,
        draft: () => commands.draft(form.hint),
        submit: commands.submit,
        transition: commands.transition,
        deleteOpen: setDeleteOpen,
    }
}

/** Actual editor controller state and atomic event owners; nullable selection has no invented entity. */
export interface ContentEditorFieldsInput {
    readonly state: ReturnType<typeof useContentEditorForm>
    readonly tab: ContentChannel
    readonly copy: ContentViews["workbenchCopy"]
    readonly capture: () => () => boolean
    readonly data: ContentWorkbenchData | undefined
    readonly item: ContentItem | null
    readonly isPending: boolean
    readonly busy: ReturnType<typeof useContentCommand>["busy"]
    readonly command: ReturnType<typeof useContentCommand>
    readonly isLibraryOpen: boolean
    readonly warnings: ReadonlyArray<ChannelWarning>
    readonly isDeleteOpen: boolean
    readonly focus: ReturnType<typeof useContentFocus>
    readonly setTab: import("react").Dispatch<import("react").SetStateAction<ContentChannel>>
    readonly setLibraryOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>
    readonly commands: ReturnType<typeof useContentEditorCommands>
    readonly setDeleteOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>
}
