import {
    Button,
    Cluster,
    FileDropzone,
    Grid,
    Image,
    MediaFrame,
    SectionHeader,
    Select,
    Stack,
    Text,
    TextAction,
    Video,
} from "@starci/grammar/common"
import type { ContentT, MediaTile } from "@/modules/types"

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
                <Video src={props.tile.url} title={props.tile.name} />
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
            <Grid kind="cards" columns={3}>
                {props.media.map((tile) => (
                    <Stack key={tile.key} gap="identity">
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
                                intent="destructive"
                                step="entry"
                                size="sm"
                                isDisabled={props.isPending}
                                onPress={() => props.onRemove(tile.key)}
                            >
                                {props.t("mediaRemove")}
                            </Button>
                        ) : null}
                    </Stack>
                ))}
            </Grid>
        )}
        {props.isEditable ? renderContentEditorMediaTools(props) : null}
        {props.isEditable && props.isLibraryOpen && props.library.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.t("mediaLibraryEmpty")}
            </Text>
        ) : null}
        {props.isEditable && props.isLibraryOpen && props.library.length > 0 ? (
            <Grid kind="cards" columns={3}>
                {props.library.map((tile) => (
                    <Stack key={tile.key} gap="identity">
                        <Thumb tile={tile} />
                        <TextAction appearance="plain" size="xs" onPress={() => props.onAttach(tile.key)}>
                            {tile.name}
                        </TextAction>
                    </Stack>
                ))}
            </Grid>
        ) : null}
    </>
)

/** Renders the ContentEditorMedia tools section. */
const renderContentEditorMediaTools = (
    props: Pick<
        ContentEditorMediaProps,
        "isPending" | "onToggleLibrary" | "t" | "isUploading" | "onUpload" | "videos" | "onAttachVideo"
    >,
) => (
    <Cluster gap="inline">
        <Button intent="neutral" size="sm" isDisabled={props.isPending} onPress={props.onToggleLibrary}>
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
    </Cluster>
)
