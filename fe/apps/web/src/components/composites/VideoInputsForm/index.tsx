import type { VideoEditorActions, VideoEditorViews } from "@/modules/types"
type VideoMediaTile = VideoEditorViews["mediaTile"]
type VideoInputsFormFields = VideoEditorViews["inputs"]
type VideoInputsFormActions = VideoEditorActions["inputs"]

interface VideoInputsFormProps extends VideoInputsFormFields {
    readonly isLoading: boolean
    readonly on: VideoInputsFormActions
}
import {
    Alert,
    Checkbox,
    CheckboxGroup,
    FileDropzone,
    Image,
    EmptyNotice,
    Grid,
    Section,
    MediaFrame,
    SurfaceCard,
    Text,
    Textarea,
    Stack,
} from "@starci/grammar/common"
import { VideoStepFooter } from "@/components/leaves/VideoStepFooter"

const previewOf = (tile: Pick<VideoMediaTile, "url" | "kind" | "name">) => {
    if (tile.url === null) return null
    if (tile.kind === "image") return <Image src={tile.url} alt={tile.name} aspect="square" />
    return (
        <MediaFrame
            aspect="square"
            media={<video src={`${tile.url}#t=0.5`} preload="metadata" muted playsInline aria-label={tile.name} />}
        />
    )
}

const sourcesOf = (props: VideoInputsFormProps) => {
    return props.sources.length === 0 ? (
        <Section
            isLoading={props.isLoading}
            title={props.sourcesHeading}
            description={props.sourcesHint}
            headingLevel={3}
        >
            {props.isLoading ? null : <EmptyNotice message={props.sourcesEmpty} />}
        </Section>
    ) : (
        <CheckboxGroup
            isLoading={props.isLoading}
            label={props.sourcesHeading}
            description={props.sourcesHint}
            isDisabled={!props.canEdit}
            value={props.sourceIds}
            options={props.sources.map((source) => ({
                value: source.value,
                label: source.label,
                description: (
                    <Text isLoading={props.isLoading} as="span" size="xs" tone="muted" overflow="clamp-2">
                        {source.excerpt}
                    </Text>
                ),
            }))}
            onValueChange={props.on.sourceIds}
        />
    )
}

/** Draws step two: public knowledge to base the video on, what to stress, photos and clips. */
export const VideoInputsForm = (props: VideoInputsFormProps) => (
    <Stack gap="section">
        {props.message === null ? null : <Alert tone={props.message.tone} title={props.message.text} />}
        <SurfaceCard isLoading={props.isLoading} label={props.heading}>
            <Stack gap="section">
                {sourcesOf(props)}
                <Textarea
                    isLoading={props.isLoading}
                    label={props.notesLabel}
                    description={props.notesHint}
                    rows={3}
                    maxLength={600}
                    value={props.notes}
                    isDisabled={!props.canEdit}
                    onValueChange={props.on.notes}
                />
            </Stack>
        </SurfaceCard>

        <SurfaceCard isLoading={props.isLoading} label={props.mediaHeading} fact={props.mediaHint}>
            <Stack gap="section">
                {props.media.length === 0 ? (
                    <Text isLoading={props.isLoading} size="sm" tone="muted">
                        {props.mediaEmpty}
                    </Text>
                ) : (
                    <Grid kind="cards" columns={4}>
                        {props.media.map((tile) => (
                            <Stack key={tile.path} gap="identity">
                                {previewOf(tile)}
                                <Checkbox
                                    isLoading={props.isLoading}
                                    label={tile.name}
                                    isSelected={tile.selected}
                                    isDisabled={!props.canEdit}
                                    onSelectedChange={() => props.on.toggleMedia(tile.path)}
                                />
                            </Stack>
                        ))}
                    </Grid>
                )}
                {props.canEdit ? (
                    <FileDropzone
                        label={props.uploadLabel}
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        multiple
                        hideFileList
                        isDisabled={props.busy}
                        prompt={props.uploadLabel}
                        onFilesChange={props.on.upload}
                    />
                ) : null}
            </Stack>
        </SurfaceCard>

        <VideoStepFooter
            isLoading={props.isLoading}
            backLabel={props.backLabel}
            nextLabel={props.nextLabel}
            pending={props.busy}
            nextDisabled={!props.canEdit}
            onBack={props.on.back}
            onNext={props.on.next}
        />
    </Stack>
)
