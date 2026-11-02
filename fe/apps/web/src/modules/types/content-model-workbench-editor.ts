import type { BadgeTone } from "@starci/grammar/common"
import type { ContentChannel, DownloadFile, HistoryRow, MediaTile, Pillar, PublishStep } from "./content"
import type {
    ContentEditorItemView,
    ContentEditorFormView,
    ContentEditorPatch,
    ContentNoteView,
    ContentTransitionView,
} from "./content-editor"
import type { ContentWorkbenchCopy } from "./content-model-workbench-copy"

/** The two actual facts typed as proof of a manual publication. */
export interface ContentPublishProof {
    readonly url: string
    readonly how: string
}
/** Ready assets of a selected post, without a form/controller/world reference. */
export interface ContentEditorAssetFields {
    readonly tabs: ReadonlyArray<{ readonly id: ContentChannel; readonly label: string }>
    readonly openVariant: {
        readonly id: ContentChannel
        readonly label: string
        readonly text: string
        readonly note: string
        readonly tags: string
        readonly maxChars: number
        readonly showTags: boolean
        readonly fieldLabel: string
        readonly characterLabel: string
    } | null
    readonly media: ReadonlyArray<MediaTile>
    readonly library: ReadonlyArray<MediaTile>
    readonly linkRows: ReadonlyArray<{ readonly key: string; readonly url: string; readonly label: string }>
    readonly steps: ReadonlyArray<PublishStep>
    readonly files: ReadonlyArray<DownloadFile>
    readonly videos: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isLibraryOpen: boolean
    readonly proof: Readonly<Partial<Record<ContentChannel, ContentPublishProof>>>
}
/** Existing editor read facts, display values and local decisions, all resolved before the pure drawing. */
export interface ContentEditorFields {
    readonly copy: ContentWorkbenchCopy
    readonly item: ContentEditorItemView
    readonly form: ContentEditorFormView
    readonly pillars: ReadonlyArray<Pillar>
    readonly statusLabel: string
    readonly tone: BadgeTone
    readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly approvedByLabel: string | null
    readonly history: ReadonlyArray<HistoryRow>
    readonly scheduledText: string
    readonly isEditable: boolean
    readonly canManage: boolean
    readonly isPending: boolean
    readonly busy: string | null
    readonly note: ContentNoteView | null
    readonly hint: string
    readonly warnings: ReadonlyArray<string>
    readonly isDeleteOpen: boolean
    readonly missingText: boolean
    readonly hasDraftText: boolean
    readonly assets: ContentEditorAssetFields
}
/** Exact atomic detail/asset commands; File is the original native upload handle, never stored in Base.props. */
export interface ContentEditorActions {
    readonly close: () => void
    readonly dismissNote: () => void
    readonly patch: (change: ContentEditorPatch) => void
    readonly channels: (values: ReadonlyArray<string>) => void
    readonly tab: (id: string) => void
    readonly text: (value: string) => void
    readonly note: (value: string) => void
    readonly tags: (value: string) => void
    readonly hint: (value: string) => void
    readonly toggleLibrary: () => void
    readonly attach: (key: string) => void
    readonly attachVideo: (id: string) => void
    readonly removeMedia: (key: string) => void
    readonly upload: (file: File) => void
    readonly link: (key: string, change: { readonly url?: string; readonly label?: string }) => void
    readonly addLink: () => void
    readonly removeLink: (key: string) => void
    readonly proof: (channel: string, change: Partial<ContentPublishProof>) => void
    readonly copy: (channel: string) => void
    readonly mark: (channel: string) => void
    readonly save: () => void
    readonly draft: () => void
    readonly submit: () => void
    readonly transition: (kind: ContentTransitionView) => void
    readonly deleteOpen: (open: boolean) => void
}

/** The nullable real selection and its independent atomic command group. */
export interface ContentEditorView {
    readonly props: ContentEditorFields | null
    readonly on: ContentEditorActions
}
