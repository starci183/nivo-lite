import type { ContentT, DownloadFile, MediaTile, PublishStep } from "@/modules/types"
import { ContentEditorLinks, type LinkRow } from "@/components/leaves/ContentEditorLinks"
import { ContentEditorMedia } from "@/components/leaves/ContentEditorMedia"
import { ContentEditorPublish, type PublishProof } from "@/components/leaves/ContentEditorPublish"
import { ContentEditorVariants, type OpenVariant } from "@/components/leaves/ContentEditorVariants"

/** The channel variants, media, links and publish proof the editor supplies. */
interface ContentEditorAssetsProps {
    readonly props: {
        readonly t: ContentT
        /** The post the assets belong to: its status decides whether the publishing proof shows. */
        readonly item: { readonly status: string }
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
