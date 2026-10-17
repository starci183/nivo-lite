import type { useTranslations } from "next-intl"
import type { ChannelWarning, channelLimits, mediaTile, postView, claimWarnings } from "@/hooks/content"
import type { Dispatch, SetStateAction } from "react"
import type {
    useContentFocus,
    useContentCommand,
    useContentEditorCommands,
    useContentFocusedItem,
    ContentChannel,
    MediaRef,
    EditorForm,
    ItemTransition,
} from "@/hooks/content"
import type { useContentEditorForm } from "@/hooks/rhf"
import { ContentEditorLinks, type LinkRow } from "@/components/leaves/ContentEditorLinks"
import { ContentEditorMedia } from "@/components/leaves/ContentEditorMedia"
import { ContentEditorPublish, type PublishProof } from "@/components/leaves/ContentEditorPublish"
import { ContentEditorVariants, type OpenVariant } from "@/components/leaves/ContentEditorVariants"
import type { ContentT, ContentItem, MediaTile, PublishStep, DownloadFile } from "@/hooks/content"

/** The channel variants, media, links and publish proof the editor supplies. */
interface ContentEditorAssetsProps {
    readonly props: {
        readonly t: ContentT
        readonly item: ContentItem
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly openVariant: OpenVariant | null
        readonly media: ReadonlyArray<MediaTile>
        readonly library: ReadonlyArray<MediaTile>
        readonly linkRows: ReadonlyArray<LinkRow>
        readonly steps: ReadonlyArray<PublishStep>
        readonly files: ReadonlyArray<DownloadFile>
        readonly videos: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly isEditable: boolean
        readonly canManage: boolean
        readonly isPending: boolean
        readonly busy: string | null
        readonly isLibraryOpen: boolean
        readonly proof: Readonly<Record<string, PublishProof | undefined>>
    }
    readonly on: {
        readonly tab: (id: string) => void
        readonly text: (text: string) => void
        readonly note: (note: string) => void
        readonly tags: (text: string) => void
        readonly toggleLibrary: () => void
        readonly attach: (key: string) => void
        readonly attachVideo: (id: string) => void
        readonly removeMedia: (key: string) => void
        readonly upload: (file: File) => void
        readonly link: (key: string, change: { readonly url?: string; readonly label?: string }) => void
        readonly addLink: () => void
        readonly removeLink: (key: string) => void
        readonly proof: (channel: string, change: Partial<PublishProof>) => void
        readonly copy: (channel: string) => void
        readonly mark: (channel: string) => void
    }
}

/** Draws the post assets and, once approved, the publishing proof. */
export const ContentEditorAssets = (props: ContentEditorAssetsProps) => {
    const { t, item, isEditable, canManage, isPending, busy } = props.props
    const on = props.on
    const status = item.status
    return (
        <>
            {props.props.openVariant ? (
                <ContentEditorVariants
                    tabs={props.props.tabs}
                    open={props.props.openVariant}
                    isEditable={isEditable && !isPending}
                    t={t}
                    onTab={on.tab}
                    onText={on.text}
                    onNote={on.note}
                    onTags={on.tags}
                />
            ) : null}
            <ContentEditorMedia
                media={props.props.media}
                library={props.props.library}
                videos={props.props.videos}
                isEditable={isEditable}
                isPending={isPending}
                isUploading={busy === "upload"}
                isLibraryOpen={props.props.isLibraryOpen}
                t={t}
                onRemove={on.removeMedia}
                onToggleLibrary={on.toggleLibrary}
                onAttach={on.attach}
                onAttachVideo={on.attachVideo}
                onUpload={on.upload}
            />
            <ContentEditorLinks
                links={props.props.linkRows}
                isEditable={isEditable && !isPending}
                t={t}
                onChange={on.link}
                onAdd={on.addLink}
                onRemove={on.removeLink}
            />
            {status === "approved" || status === "published" ? (
                <ContentEditorPublish
                    steps={props.props.steps}
                    files={props.props.files}
                    proof={props.props.proof}
                    canManage={canManage}
                    isPending={isPending}
                    busy={busy}
                    t={t}
                    onProof={on.proof}
                    onCopy={on.copy}
                    onMark={on.mark}
                />
            ) : null}
        </>
    )
}

/** Commands exposed by the connected post editor. */
interface ContentEditorEvents {
    readonly close: () => void
    readonly dismissNote: () => void
    readonly patch: (change: Partial<EditorForm>) => void
    readonly channels: (values: ReadonlyArray<string>) => void
    readonly tab: (id: string) => void
    readonly text: (text: string) => void
    readonly note: (note: string) => void
    readonly tags: (text: string) => void
    readonly hint: (hint: string) => void
    readonly toggleLibrary: () => void
    readonly attach: (key: string) => void
    readonly attachVideo: (id: string) => void
    readonly removeMedia: (key: string) => void
    readonly upload: (file: File) => void
    readonly link: (key: string, change: { readonly url?: string; readonly label?: string }) => void
    readonly addLink: () => void
    readonly removeLink: (key: string) => void
    readonly proof: (channel: string, change: Partial<PublishProof>) => void
    readonly copy: (channel: string) => void
    readonly mark: (channel: string) => void
    readonly save: () => void
    readonly draft: () => void
    readonly submit: () => void
    readonly transition: (kind: ItemTransition) => void
    readonly deleteOpen: (open: boolean) => void
}

/** State and commands consumed by the editor event mapping. */
interface ContentEditorEventsInput {
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
    readonly data: ReturnType<typeof useContentFocusedItem>["data"]
    readonly form: EditorForm
    readonly withChannel: (id: string, run: (channel: ContentChannel) => void) => void
    readonly setDeleteOpen: Dispatch<SetStateAction<boolean>>
}

/** Maps editor interactions to the injected form and command state. */
export const contentEditorEvents = (
    connected: ContentEditorEventsInput,
    channels: ReadonlyArray<ContentChannel>,
): ContentEditorEvents => {
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
            const video = data.videos.find((v) => v.id === id)
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
                void state.validateProof(id).then((valid) => {
                    if (valid) commands.markPosted(id, form.proof[id])
                })
            }),
        save: commands.save,
        draft: () => commands.draft(form.hint),
        submit: commands.submit,
        transition: commands.transition,
        deleteOpen: setDeleteOpen,
    }
}

/** Hook results and local state supplied by the connected editor. */
interface ContentEditorStateInput {
    readonly state: ReturnType<typeof useContentEditorForm>
    readonly tab: ContentChannel
    readonly t: ReturnType<typeof useTranslations<"content">>
    readonly data: ReturnType<typeof useContentFocusedItem>["data"]
    readonly item: ReturnType<typeof useContentFocusedItem>["item"]
    readonly isPending: boolean
    readonly busy: ReturnType<typeof useContentCommand>["busy"] | "draft"
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

/** Pure content conversions injected by the connected editor. */
interface ContentEditorViewFunctions {
    readonly channels: ReadonlyArray<ContentChannel>
    readonly channelLimits: typeof channelLimits
    readonly mediaTile: typeof mediaTile
    readonly postView: typeof postView
    readonly claimWarnings: typeof claimWarnings
}

/** Derives the active channel, library and live warnings from the editor state. */
export const buildContentPostEditorState = (input: ContentEditorStateInput, utils: ContentEditorViewFunctions) => {
    const { state, tab, t, data, item } = input
    const { form, patch } = state
    const withChannel = (id: string, run: (channel: ContentChannel) => void): void => {
        const found = utils.channels.find((c) => c === id)
        if (found !== undefined) run(found)
    }
    const active = form.channels.includes(tab) ? tab : (form.channels[0] ?? "facebook")
    const limits = utils.channelLimits(t, active)
    const tile = (m: MediaRef) => utils.mediaTile(m, data.urls)
    const library = data.library.filter((m) => !form.media.some((x) => x.path === m.path))
    const view = utils.postView(t, item, {})
    const live = form.channels.flatMap((channel) =>
        utils.claimWarnings(form.variants[channel]?.text ?? "").map((warning) => ({ channel, warning })),
    )
    return { ...input, form, patch, withChannel, active, limits, tile, library, view, live }
}
