import {
    Button,
    FileDropzone,
    Image,
    MediaFrame,
    SectionHeader,
    Select,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { ContentT, MediaTile } from "@/hooks/content"
import { MEDIA_GRID_CLASS_NAME, MEDIA_TILE_CLASS_NAME, TOOLS_CLASS_NAME } from "./classNames"

/** Props of {@link ContentEditorMedia}. */
interface ContentEditorMediaProps {
    readonly media: ReadonlyArray<MediaTile>
    /** Library files not attached yet. */
    readonly library: ReadonlyArray<MediaTile>
    /** Rendered videos not attached yet, with their labels. */
    readonly videos: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isEditable: boolean
    readonly isPending: boolean
    readonly isUploading: boolean
    readonly isLibraryOpen: boolean
    readonly t: ContentT
    readonly onRemove: (key: string) => void
    readonly onToggleLibrary: () => void
    readonly onAttach: (key: string) => void
    readonly onAttachVideo: (id: string) => void
    readonly onUpload: (file: File) => void
}

interface ThumbProps {
    readonly tile: MediaTile
}

const Thumb = (props: ThumbProps) => {
    if (props.tile.url !== null && props.tile.kind === "image") {
        return <Image src={props.tile.url} alt={props.tile.name} aspect="landscape" loading="lazy" />
    }
    if (props.tile.url !== null && props.tile.kind === "video") {
        return (
            <MediaFrame aspect="landscape">
                <video src={props.tile.url} controls preload="metadata" aria-label={props.tile.name} />
            </MediaFrame>
        )
    }
    return (
        <Text size="xs" tone="muted">
            {props.tile.name}
        </Text>
    )
}

/** The pictures and videos of a post: the attached ones, the library to pick from, an upload and the rendered videos. */
export const ContentEditorMedia = (props: ContentEditorMediaProps) => (
    <>
        <SectionHeader level={3} title={props.t("mediaTitle")} />
        {props.media.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.t("mediaEmpty")}
            </Text>
        ) : (
            <div className={MEDIA_GRID_CLASS_NAME}>
                {props.media.map((tile) => (
                    <div key={tile.key} className={MEDIA_TILE_CLASS_NAME}>
                        <Thumb tile={tile} />
                        <Text size="xs" overflow="truncate">
                            {tile.name}
                        </Text>
                        {tile.isSuggested ? (
                            <Text size="xs" tone="muted">
                                {props.t("mediaSuggested")}
                            </Text>
                        ) : null}
                        {props.isEditable ? (
                            <Button
                                variant="danger-soft"
                                size="sm"
                                isDisabled={props.isPending}
                                onPress={() => props.onRemove(tile.key)}
                            >
                                {props.t("mediaRemove")}
                            </Button>
                        ) : null}
                    </div>
                ))}
            </div>
        )}
        {props.isEditable ? (
            <div className={TOOLS_CLASS_NAME}>
                <Button variant="outline" size="sm" isDisabled={props.isPending} onPress={props.onToggleLibrary}>
                    {props.t("mediaAttachLibrary")}
                </Button>
                <FileDropzone
                    label={props.t("mediaUpload")}
                    isLabelHidden
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    hideFileList
                    isDisabled={props.isPending}
                    prompt={props.isUploading ? props.t("mediaUploading") : props.t("mediaUpload")}
                    onFilesChange={(files) => {
                        if (files[0] !== undefined) props.onUpload(files[0])
                    }}
                />
                {props.videos.length > 0 ? (
                    <Select
                        variant="secondary"
                        label={props.t("mediaVideo")}
                        isLabelHidden
                        placeholder={props.t("mediaVideo")}
                        options={props.videos}
                        value={null}
                        isDisabled={props.isPending}
                        onValueChange={(id) => {
                            if (id) props.onAttachVideo(id)
                        }}
                    />
                ) : null}
            </div>
        ) : null}
        {props.isEditable && props.isLibraryOpen && props.library.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.t("mediaLibraryEmpty")}
            </Text>
        ) : null}
        {props.isEditable && props.isLibraryOpen && props.library.length > 0 ? (
            <div className={MEDIA_GRID_CLASS_NAME}>
                {props.library.map((tile) => (
                    <div key={tile.key} className={MEDIA_TILE_CLASS_NAME}>
                        <Thumb tile={tile} />
                        <TextAction appearance="plain" size="xs" onPress={() => props.onAttach(tile.key)}>
                            {tile.name}
                        </TextAction>
                    </div>
                ))}
            </div>
        ) : null}
    </>
)
