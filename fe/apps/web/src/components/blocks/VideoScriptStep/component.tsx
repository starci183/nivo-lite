import { Alert, Badge, Button, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"
import { VideoStepFooter } from "@/components/leaves/VideoStepFooter"
import { SCRIPT_ROW, SCRIPT_STACK } from "./classNames"

/** One scene card of the script. */
export interface VideoSceneCard {
    readonly id: string
    readonly title: string
    readonly roleLabel: string
    readonly roleTone: "accent" | "neutral" | "success"
    readonly caption: string
    readonly voiceover: string
    readonly visualHint: string | null
    readonly media: string
    readonly canMoveUp: boolean
    readonly canMoveDown: boolean
    readonly canRemove: boolean
}

/** One file the scene can show. */
export interface VideoSceneMediaOption {
    readonly id: string
    readonly label: string
}

/** Copy, state and handlers of the script step. */
export interface VideoScriptStepBaseProps {
    readonly props: {
        readonly heading: string
        readonly tookLabel: string | undefined
        readonly writing: boolean
        readonly writingLabel: string
        readonly emptyLabel: string
        readonly hasScenes: boolean
        readonly writeLabel: string
        readonly rewriteWarn: string | null
        readonly scenes: ReadonlyArray<VideoSceneCard>
        readonly mediaOptions: ReadonlyArray<VideoSceneMediaOption>
        readonly captionLabel: string
        readonly voiceLabel: string
        readonly mediaLabel: string
        readonly moveUpLabel: string
        readonly moveDownLabel: string
        readonly removeLabel: string
        readonly addLabel: string
        readonly canAdd: boolean
        readonly backLabel: string
        readonly nextLabel: string
        readonly estimateLabel: string | null
        readonly canEdit: boolean
        readonly locked: boolean
        readonly saving: boolean
        readonly canContinue: boolean
        readonly error: string | null
        readonly dismissLabel: string
    }
    readonly on: {
        readonly write: () => void
        readonly caption: (index: number, value: string) => void
        readonly voiceover: (index: number, value: string) => void
        readonly media: (index: number, value: string | null) => void
        readonly move: (index: number, direction: -1 | 1) => void
        readonly remove: (index: number) => void
        readonly add: () => void
        readonly back: () => void
        readonly next: () => void
        readonly dismissError: () => void
    }
}

/** Draws step three: ask NIVO to write the script, then edit it scene by scene. */
export const VideoScriptStepBase = (props: VideoScriptStepBaseProps) => (
    <div className={SCRIPT_STACK}>
        <VideoErrorAlert
            message={props.props.error}
            dismissLabel={props.props.dismissLabel}
            onDismiss={props.on.dismissError}
        />
        <SurfaceCard label={props.props.heading} fact={props.props.tookLabel}>
            <div className={SCRIPT_STACK}>
                {props.props.writing ? <Alert tone="informative" title={props.props.writingLabel} /> : null}
                {!props.props.hasScenes && !props.props.writing ? (
                    <Text size="sm" tone="muted">
                        {props.props.emptyLabel}
                    </Text>
                ) : null}
                <div className={SCRIPT_ROW}>
                    <Button
                        variant={props.props.hasScenes ? "secondary" : "primary"}
                        isPending={props.props.writing}
                        isDisabled={!props.props.canEdit}
                        onPress={props.on.write}
                    >
                        {props.props.writeLabel}
                    </Button>
                    {props.props.rewriteWarn === null ? null : (
                        <Text as="span" size="xs" tone="muted">
                            {props.props.rewriteWarn}
                        </Text>
                    )}
                </div>
            </div>
        </SurfaceCard>

        {props.props.scenes.map((scene, index) => (
            <SurfaceCard
                key={scene.id}
                label={scene.title}
                headingLevel={3}
                labelEnd={
                    <div className={SCRIPT_ROW}>
                        <Badge tone={scene.roleTone}>{scene.roleLabel}</Badge>
                        <Button
                            size="sm"
                            variant="ghost"
                            isDisabled={props.props.locked || !scene.canMoveUp}
                            onPress={() => props.on.move(index, -1)}
                        >
                            {props.props.moveUpLabel}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            isDisabled={props.props.locked || !scene.canMoveDown}
                            onPress={() => props.on.move(index, 1)}
                        >
                            {props.props.moveDownLabel}
                        </Button>
                        <Button
                            size="sm"
                            variant="danger-soft"
                            isDisabled={props.props.locked || !scene.canRemove}
                            onPress={() => props.on.remove(index)}
                        >
                            {props.props.removeLabel}
                        </Button>
                    </div>
                }
            >
                <div className={SCRIPT_STACK}>
                    <Textarea
                        label={props.props.captionLabel}
                        variant="secondary"
                        rows={2}
                        maxLength={160}
                        value={scene.caption}
                        isDisabled={props.props.locked}
                        onValueChange={(value) => props.on.caption(index, value)}
                    />
                    <Textarea
                        label={props.props.voiceLabel}
                        variant="secondary"
                        rows={3}
                        maxLength={420}
                        value={scene.voiceover}
                        isDisabled={props.props.locked}
                        onValueChange={(value) => props.on.voiceover(index, value)}
                    />
                    {scene.visualHint === null ? null : (
                        <Text size="xs" tone="muted">
                            {scene.visualHint}
                        </Text>
                    )}
                    <Select
                        label={props.props.mediaLabel}
                        variant="secondary"
                        value={scene.media}
                        options={props.props.mediaOptions}
                        isDisabled={props.props.locked}
                        onValueChange={(value) => props.on.media(index, value)}
                    />
                </div>
            </SurfaceCard>
        ))}

        {props.props.canEdit ? (
            <div className={SCRIPT_ROW}>
                <Button variant="outline" isDisabled={props.props.locked || !props.props.canAdd} onPress={props.on.add}>
                    {props.props.addLabel}
                </Button>
            </div>
        ) : null}

        <VideoStepFooter
            backLabel={props.props.backLabel}
            nextLabel={props.props.nextLabel}
            note={props.props.estimateLabel}
            pending={props.props.saving}
            nextDisabled={props.props.locked || !props.props.canContinue}
            onBack={props.on.back}
            onNext={props.on.next}
        />
    </div>
)
