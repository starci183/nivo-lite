import {
    Alert,
    Checkbox,
    CheckboxGroup,
    FileDropzone,
    Image,
    List,
    ListItem,
    MediaFrame,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { VideoStepFooter } from "@/components/leaves/VideoStepFooter"
import { INPUTS_COPY, INPUTS_MEDIA_GRID, INPUTS_STACK } from "./classNames"

/** One public source the video may be based on. */
export interface VideoSourceOption {
    readonly value: string
    readonly label: string
    readonly excerpt: string
}

/** One uploaded file in the picker. */
export interface VideoMediaTile {
    readonly path: string
    readonly name: string
    readonly kind: "image" | "video"
    readonly url: string | null
    readonly selected: boolean
}

/** Copy, state and handlers of the material step. */
export interface VideoInputsStepBaseProps {
    readonly props: {
        readonly heading: string
        readonly sourcesHeading: string
        readonly sourcesHint: string
        readonly sourcesEmpty: string
        readonly sources: ReadonlyArray<VideoSourceOption>
        readonly sourceIds: ReadonlyArray<string>
        readonly notesLabel: string
        readonly notesHint: string
        readonly notes: string
        readonly mediaHeading: string
        readonly mediaHint: string
        readonly mediaEmpty: string
        readonly media: ReadonlyArray<VideoMediaTile>
        readonly uploadLabel: string
        readonly backLabel: string
        readonly nextLabel: string
        readonly canEdit: boolean
        readonly busy: boolean
        readonly message: { readonly tone: "negative" | "informative"; readonly text: string } | null
    }
    readonly on: {
        readonly sourceIds: (ids: ReadonlyArray<string>) => void
        readonly notes: (value: string) => void
        readonly toggleMedia: (path: string) => void
        readonly upload: (files: ReadonlyArray<File>) => void
        readonly back: () => void
        readonly next: () => void
    }
}

const previewOf = (tile: Pick<VideoMediaTile, "url" | "kind" | "name">) => {
    if (tile.url === null) return null
    if (tile.kind === "image") return <Image src={tile.url} alt={tile.name} aspect="square" />
    return (
        <MediaFrame aspect="square">
            <video src={`${tile.url}#t=0.5`} preload="metadata" muted playsInline aria-label={tile.name} />
        </MediaFrame>
    )
}

const sourcesOf = (props: VideoInputsStepBaseProps) => {
    return (
        <>
            {props.props.sources.length === 0 ? (
                <div className={INPUTS_COPY}>
                    <Text weight="semibold">{props.props.sourcesHeading}</Text>
                    <Text size="xs" tone="muted">
                        {props.props.sourcesHint}
                    </Text>
                    <Text size="sm" tone="muted">
                        {props.props.sourcesEmpty}
                    </Text>
                </div>
            ) : (
                <CheckboxGroup
                    label={props.props.sourcesHeading}
                    description={props.props.sourcesHint}
                    variant="secondary"
                    isDisabled={!props.props.canEdit}
                    value={props.props.sourceIds}
                    options={props.props.sources.map((source) => ({
                        value: source.value,
                        label: source.label,
                        description: (
                            <Text as="span" size="xs" tone="muted" overflow="clamp-2">
                                {source.excerpt}
                            </Text>
                        ),
                    }))}
                    onValueChange={props.on.sourceIds}
                />
            )}
        </>
    )
}

/** Draws step two: public knowledge to base the video on, what to stress, photos and clips. */
export const VideoInputsStepBase = (props: VideoInputsStepBaseProps) => (
    <div className={INPUTS_STACK}>
        {props.props.message === null ? null : (
            <Alert tone={props.props.message.tone} title={props.props.message.text} />
        )}
        <SurfaceCard label={props.props.heading}>
            <div className={INPUTS_STACK}>
                {sourcesOf(props)}
                <Textarea
                    label={props.props.notesLabel}
                    variant="secondary"
                    description={props.props.notesHint}
                    rows={3}
                    maxLength={600}
                    value={props.props.notes}
                    isDisabled={!props.props.canEdit}
                    onValueChange={props.on.notes}
                />
            </div>
        </SurfaceCard>

        <SurfaceCard label={props.props.mediaHeading} fact={props.props.mediaHint}>
            <div className={INPUTS_STACK}>
                {props.props.media.length === 0 ? (
                    <Text size="sm" tone="muted">
                        {props.props.mediaEmpty}
                    </Text>
                ) : (
                    <List className={INPUTS_MEDIA_GRID} label={props.props.mediaHeading}>
                        {props.props.media.map((tile) => (
                            <ListItem key={tile.path} className={INPUTS_COPY}>
                                {previewOf(tile)}
                                <Checkbox
                                    label={tile.name}
                                    variant="secondary"
                                    isSelected={tile.selected}
                                    isDisabled={!props.props.canEdit}
                                    onSelectedChange={() => props.on.toggleMedia(tile.path)}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
                {props.props.canEdit ? (
                    <FileDropzone
                        label={props.props.uploadLabel}
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        multiple
                        hideFileList
                        isDisabled={props.props.busy}
                        prompt={props.props.uploadLabel}
                        onFilesChange={props.on.upload}
                    />
                ) : null}
            </div>
        </SurfaceCard>

        <VideoStepFooter
            backLabel={props.props.backLabel}
            nextLabel={props.props.nextLabel}
            pending={props.props.busy}
            nextDisabled={!props.props.canEdit}
            onBack={props.on.back}
            onNext={props.on.next}
        />
    </div>
)
