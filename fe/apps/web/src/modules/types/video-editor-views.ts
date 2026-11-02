interface VideoGoalOption {
    readonly value: string
    readonly label: string
    readonly description?: string
}

interface VideoGoalFormFields {
    readonly heading: string
    readonly goals: ReadonlyArray<VideoGoalOption>
    readonly goal: string
    readonly aspectLabel: string
    readonly aspects: ReadonlyArray<VideoGoalOption>
    readonly aspect: string
    readonly durationLabel: string
    readonly durations: ReadonlyArray<VideoGoalOption>
    readonly seconds: string
    readonly titleLabel: string
    readonly titleHint: string
    readonly title: string
    readonly nextLabel: string
    readonly disabled: boolean
    readonly pending: boolean
    readonly error: string | null
    readonly dismissLabel: string
}

interface VideoGoalFormActions {
    readonly goal: (value: string) => void
    readonly aspect: (value: string) => void
    readonly seconds: (value: string) => void
    readonly title: (value: string) => void
    readonly next: () => void
    readonly dismissError: () => void
}

interface VideoSourceOption {
    readonly value: string
    readonly label: string
    readonly excerpt: string
}

interface VideoMediaTile {
    readonly path: string
    readonly name: string
    readonly kind: "image" | "video"
    readonly url: string | null
    readonly selected: boolean
}

interface VideoInputsFormFields {
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

interface VideoInputsFormActions {
    readonly sourceIds: (ids: ReadonlyArray<string>) => void
    readonly notes: (value: string) => void
    readonly toggleMedia: (path: string) => void
    readonly upload: (files: ReadonlyArray<File>) => void
    readonly back: () => void
    readonly next: () => void
}

interface VideoSceneCard {
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

interface VideoSceneMediaOption {
    readonly id: string
    readonly label: string
}

interface VideoScriptFormFields {
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

interface VideoScriptFormActions {
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

interface VideoStepperStep {
    readonly id: string
    readonly label: string
    readonly isDisabled: boolean
}

interface VideoEditStepsFields {
    readonly toLibrary: string
    readonly libraryHref: string
    readonly stepperLabel: string
    readonly steps: ReadonlyArray<VideoStepperStep>
    readonly current: string
    readonly viewOnly: string | null
}

interface VideoEditStepsActions {
    readonly select: (id: string) => void
}

/** Resolved editor fields and their drawing vocabulary. */
export interface VideoEditorViews {
    readonly goal: VideoGoalFormFields
    readonly mediaTile: VideoMediaTile
    readonly inputs: VideoInputsFormFields
    readonly scene: VideoSceneCard
    readonly sceneMediaOption: VideoSceneMediaOption
    readonly script: VideoScriptFormFields
    readonly stepper: VideoEditStepsFields
}

/** Commands initiated by the editor drawings. */
export interface VideoEditorActions {
    readonly goal: VideoGoalFormActions
    readonly inputs: VideoInputsFormActions
    readonly script: VideoScriptFormActions
    readonly stepper: VideoEditStepsActions
}
