import type { VideoEditorViews } from "@/modules/types"
type Scene = VideoEditorViews["scene"]
type VideoSceneMediaOption = VideoEditorViews["sceneMediaOption"]
import { Cluster, Stack, Badge, Button, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"

interface VideoSceneCardProps {
    readonly scene: Scene
    readonly locked: boolean
    readonly isLoading: boolean
    readonly mediaOptions: ReadonlyArray<VideoSceneMediaOption>
    readonly captionLabel: string
    readonly voiceLabel: string
    readonly mediaLabel: string
    readonly moveUpLabel: string
    readonly moveDownLabel: string
    readonly removeLabel: string
    readonly on: {
        readonly move: (direction: -1 | 1) => void
        readonly remove: () => void
        readonly caption: (value: string) => void
        readonly voiceover: (value: string) => void
        readonly media: (value: string | null) => void
    }
}
/** One script scene keeps its original controls and card anatomy. */
export const VideoSceneCard = (props: VideoSceneCardProps) => (
    <SurfaceCard
        isLoading={props.isLoading}

        label={props.scene.title}
        headingLevel={3}
        labelEnd={
            <Cluster gap="inline">
                <Badge tone={props.scene.roleTone}>{props.scene.roleLabel}</Badge>
                <Button
                    isLoading={props.isLoading}
                    size="sm"
                    intent="neutral"
                    isDisabled={props.locked || !props.scene.canMoveUp}
                    onPress={() => props.on.move(-1)}
                >
                    {props.moveUpLabel}
                </Button>
                <Button
                    isLoading={props.isLoading}
                    size="sm"
                    intent="neutral"
                    isDisabled={props.locked || !props.scene.canMoveDown}
                    onPress={() => props.on.move(1)}
                >
                    {props.moveDownLabel}
                </Button>
                <Button
                    isLoading={props.isLoading}
                    size="sm"
                    intent="destructive"
                    step="entry"
                    isDisabled={props.locked || !props.scene.canRemove}
                    onPress={() => props.on.remove()}
                >
                    {props.removeLabel}
                </Button>
            </Cluster>
        }
    >
        <Stack gap="section">
            <Textarea
                isLoading={props.isLoading}
                label={props.captionLabel}
                rows={2}
                maxLength={160}
                value={props.scene.caption}
                isDisabled={props.locked}
                onValueChange={(value) => props.on.caption(value)}
            />
            <Textarea
                isLoading={props.isLoading}
                label={props.voiceLabel}
                rows={3}
                maxLength={420}
                value={props.scene.voiceover}
                isDisabled={props.locked}
                onValueChange={(value) => props.on.voiceover(value)}
            />
            {props.scene.visualHint === null ? null : (
                <Text isLoading={props.isLoading} size="xs" tone="muted">
                    {props.scene.visualHint}
                </Text>
            )}
            <Select
                isLoading={props.isLoading}
                label={props.mediaLabel}
                value={props.scene.media}
                options={props.mediaOptions}
                isDisabled={props.locked}
                onValueChange={(value) => props.on.media(value)}
            />
        </Stack>
    </SurfaceCard>
)
