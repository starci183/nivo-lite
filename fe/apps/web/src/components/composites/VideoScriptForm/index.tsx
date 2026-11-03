import type { VideoEditorActions, VideoEditorViews, VideoWorkbenchViews } from "@/modules/types"
type VideoEditorPanelFields = VideoWorkbenchViews["editorPanel"]
type VideoScriptFormFields = VideoEditorViews["script"]
type VideoScriptFormActions = VideoEditorActions["script"]
import { VideoSceneCard } from "@/components/branches/VideoSceneCard"

/** Only absent-read script facts: no project, draft, copy, command or row is fabricated. */
export const VIDEO_SCRIPT_FORM_READ_DEFAULTS: NonNullable<VideoEditorPanelFields["script"]> = {
    tookLabel: undefined,
    mediaOptions: [],
    canEdit: false,
    isScripting: false,
    jobState: null,
    projectFailure: null,
}

interface VideoScriptFormProps extends VideoScriptFormFields {
    readonly isLoading: boolean
    readonly on: VideoScriptFormActions
}
import { Cluster, Stack, Alert, Button, SurfaceCard, Text } from "@starci/grammar/common"

import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"
import { VideoStepFooter } from "@/components/leaves/VideoStepFooter"

const sceneActionsOf = (props: VideoScriptFormProps, index: number) => ({
    move: (direction: -1 | 1) => props.on.move(index, direction),
    remove: () => props.on.remove(index),
    caption: (value: string) => props.on.caption(index, value),
    voiceover: (value: string) => props.on.voiceover(index, value),
    media: (value: string | null) => props.on.media(index, value),
})

const scenesOf = (props: VideoScriptFormProps) => (
    <>
        {props.scenes.map((scene, index) => (
            <VideoSceneCard
                key={scene.id}
                scene={scene}
                locked={props.locked}
                isLoading={props.isLoading}
                mediaOptions={props.mediaOptions}
                captionLabel={props.captionLabel}
                voiceLabel={props.voiceLabel}
                mediaLabel={props.mediaLabel}
                moveUpLabel={props.moveUpLabel}
                moveDownLabel={props.moveDownLabel}
                removeLabel={props.removeLabel}
                on={sceneActionsOf(props, index)}
            />
        ))}
    </>
)

/** Draws step three: ask NIVO to write the script, then edit it scene by scene. */
export const VideoScriptForm = (props: VideoScriptFormProps) => (
    <Stack gap="section">
        <VideoErrorAlert message={props.error} dismissLabel={props.dismissLabel} onDismiss={props.on.dismissError} />
        <SurfaceCard
            isLoading={props.isLoading}
            label={props.heading}
            {...(props.tookLabel === undefined ? {} : { fact: props.tookLabel })}
        >
            <Stack gap="section">
                {props.writing ? <Alert tone="informative" title={props.writingLabel} /> : null}
                {!props.hasScenes && !props.writing ? (
                    <Text isLoading={props.isLoading} size="sm" tone="muted">
                        {props.emptyLabel}
                    </Text>
                ) : null}
                <Cluster gap="inline">
                    <Button
                        isLoading={props.isLoading}
                        intent={props.hasScenes ? "alternative" : "commit"}
                        isPending={props.writing}
                        isDisabled={!props.canEdit}
                        onPress={props.on.write}
                    >
                        {props.writeLabel}
                    </Button>
                    {props.rewriteWarn === null ? null : (
                        <Text isLoading={props.isLoading} as="span" size="xs" tone="muted">
                            {props.rewriteWarn}
                        </Text>
                    )}
                </Cluster>
            </Stack>
        </SurfaceCard>

        {scenesOf(props)}
        {props.canEdit ? (
            <Cluster gap="inline">
                <Button
                    isLoading={props.isLoading}
                    intent="neutral"
                    isDisabled={props.locked || !props.canAdd}
                    onPress={props.on.add}
                >
                    {props.addLabel}
                </Button>
            </Cluster>
        ) : null}

        <VideoStepFooter
            isLoading={props.isLoading}
            backLabel={props.backLabel}
            nextLabel={props.nextLabel}
            note={props.estimateLabel}
            pending={props.saving}
            nextDisabled={props.locked || !props.canContinue}
            onBack={props.on.back}
            onNext={props.on.next}
        />
    </Stack>
)
