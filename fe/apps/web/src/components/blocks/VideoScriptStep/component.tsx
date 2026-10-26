import type { useTranslations } from "next-intl"
import type { SceneRole, ScriptScene } from "@/hooks/video"
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

/** The option that means a colour card without a file. */
const NO_MEDIA = "none"

const ROLE_TONE: Record<SceneRole, "accent" | "neutral" | "success"> = {
    hook: "accent",
    body: "neutral",
    cta: "success",
}

/** Translated labels shared by the script controls. */
export const scriptCopyOf = (t: ReturnType<typeof useTranslations<"video">>) => ({
    heading: t("scriptHeading"),
    writingLabel: t("scripting"),
    emptyLabel: t("scriptEmpty"),
    captionLabel: t("captionLabel"),
    voiceLabel: t("voiceLabel"),
    mediaLabel: t("mediaPick"),
    moveUpLabel: t("moveUp"),
    moveDownLabel: t("moveDown"),
    removeLabel: t("removeScene"),
    addLabel: t("addScene"),
    backLabel: t("back"),
    nextLabel: t("next"),
    dismissLabel: t("back"),
})

/** Maps editable script scenes to the atoms drawn by each scene card. */
export const sceneCardsOf = (scenes: ReadonlyArray<ScriptScene>, t: ReturnType<typeof useTranslations<"video">>) =>
    scenes.map((scene, index) => ({
        id: scene.id,
        title: t("sceneN", { n: index + 1 }),
        roleLabel: t(`role_${scene.role}`),
        roleTone: ROLE_TONE[scene.role],
        caption: scene.caption,
        voiceover: scene.voiceover,
        visualHint: scene.visual === "" ? null : t("visualHint", { text: scene.visual }),
        media: scene.media ?? NO_MEDIA,
        canMoveUp: index > 0,
        canMoveDown: index < scenes.length - 1,
        canRemove: scenes.length > 1,
    }))

const scenesOf = (props: VideoScriptStepBaseProps) => {
    return (
        <>
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
                                intent="neutral"
                                isDisabled={props.props.locked || !scene.canMoveUp}
                                onPress={() => props.on.move(index, -1)}
                            >
                                {props.props.moveUpLabel}
                            </Button>
                            <Button
                                size="sm"
                                intent="neutral"
                                isDisabled={props.props.locked || !scene.canMoveDown}
                                onPress={() => props.on.move(index, 1)}
                            >
                                {props.props.moveDownLabel}
                            </Button>
                            <Button
                                size="sm"
                                intent="destructive"
                                step="entry"
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
                            rows={2}
                            maxLength={160}
                            value={scene.caption}
                            isDisabled={props.props.locked}
                            onValueChange={(value) => props.on.caption(index, value)}
                        />
                        <Textarea
                            label={props.props.voiceLabel}
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
                            value={scene.media}
                            options={props.props.mediaOptions}
                            isDisabled={props.props.locked}
                            onValueChange={(value) => props.on.media(index, value)}
                        />
                    </div>
                </SurfaceCard>
            ))}
        </>
    )
}

/** Draws step three: ask NIVO to write the script, then edit it scene by scene. */
export const VideoScriptStepBase = (props: VideoScriptStepBaseProps) => (
    <div className={SCRIPT_STACK}>
        <VideoErrorAlert
            message={props.props.error}
            dismissLabel={props.props.dismissLabel}
            onDismiss={props.on.dismissError}
        />
        <SurfaceCard
            label={props.props.heading}
            {...(props.props.tookLabel === undefined ? {} : { fact: props.props.tookLabel })}
        >
            <div className={SCRIPT_STACK}>
                {props.props.writing ? <Alert tone="informative" title={props.props.writingLabel} /> : null}
                {!props.props.hasScenes && !props.props.writing ? (
                    <Text size="sm" tone="muted">
                        {props.props.emptyLabel}
                    </Text>
                ) : null}
                <div className={SCRIPT_ROW}>
                    <Button
                        intent={props.props.hasScenes ? "alternative" : "commit"}
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

        {scenesOf(props)}
        {props.props.canEdit ? (
            <div className={SCRIPT_ROW}>
                <Button intent="neutral" isDisabled={props.props.locked || !props.props.canAdd} onPress={props.on.add}>
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

/** Reorders two valid scene positions without changing scene identities. */
export const swapped = (
    scenes: ReadonlyArray<ScriptScene>,
    index: number,
    target: number,
): ReadonlyArray<ScriptScene> => {
    const from = scenes[index]
    const to = scenes[target]
    if (from === undefined || to === undefined) return scenes
    return scenes.map((scene, at) => {
        if (at === index) return to
        return at === target ? from : scene
    })
}
