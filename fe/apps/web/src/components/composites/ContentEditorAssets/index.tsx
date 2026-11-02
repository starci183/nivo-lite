import type { ContentViews, ContentActions } from "@/modules/types"

type ContentEditorAssetsProps = ContentViews["editorAssetFields"] &
    Pick<ContentViews["editorFields"], "copy" | "item" | "isEditable" | "canManage" | "isPending" | "busy"> & {
        readonly on: Pick<
            ContentActions["editorActions"],
            | "tab"
            | "text"
            | "note"
            | "tags"
            | "toggleLibrary"
            | "attach"
            | "attachVideo"
            | "removeMedia"
            | "upload"
            | "link"
            | "addLink"
            | "removeLink"
            | "proof"
            | "copy"
            | "mark"
        >
    }
import { ContentEditorLinks } from "@/components/leaves/ContentEditorLinks"
import { ContentEditorMedia } from "@/components/leaves/ContentEditorMedia"
import { ContentEditorPublish } from "@/components/leaves/ContentEditorPublish"
import { ContentEditorVariants } from "@/components/leaves/ContentEditorVariants"

/** Draws the post assets and, once approved, the publishing proof. */
export const ContentEditorAssets = (props: ContentEditorAssetsProps) => {
    const { copy, item, isEditable, canManage, isPending, busy } = props
    const on = props.on
    const status = item.status
    return (
        <>
            {props.openVariant ? (
                <ContentEditorVariants
                    tabs={props.tabs}
                    open={props.openVariant}
                    isEditable={isEditable && !isPending}
                    copy={copy}
                    onTab={on.tab}
                    onText={on.text}
                    onNote={on.note}
                    onTags={on.tags}
                />
            ) : null}
            <ContentEditorMedia
                media={props.media}
                library={props.library}
                videos={props.videos}
                isEditable={isEditable}
                isPending={isPending}
                isUploading={busy === "upload"}
                isLibraryOpen={props.isLibraryOpen}
                copy={copy}
                onRemove={on.removeMedia}
                onToggleLibrary={on.toggleLibrary}
                onAttach={on.attach}
                onAttachVideo={on.attachVideo}
                onUpload={on.upload}
            />
            <ContentEditorLinks
                links={props.linkRows}
                isEditable={isEditable && !isPending}
                copy={copy}
                onChange={on.link}
                onAdd={on.addLink}
                onRemove={on.removeLink}
            />
            {status === "approved" || status === "published" ? (
                <ContentEditorPublish
                    steps={props.steps}
                    files={props.files}
                    proof={props.proof}
                    canManage={canManage}
                    isPending={isPending}
                    busy={busy}
                    copy={copy}
                    onProof={on.proof}
                    onCopy={on.copy}
                    onMark={on.mark}
                />
            ) : null}
        </>
    )
}
