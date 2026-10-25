import { Button, FileDropzone } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ACTIONS_CLASS_NAME, CONTROLS_CLASS_NAME, EDITOR_CLASS_NAME } from "./classNames"

/** What the picture editor draws and does. */
type AvatarEditorProps = {
    /** The live preview: the chosen picture while it uploads, else the saved one or the generated avatar. */
    readonly preview: ReactNode
    readonly id: string
    readonly label: string
    readonly prompt: string
    readonly hint: string
    readonly accept: string
    /** Why the chosen picture was refused, or undefined. */
    readonly error?: string | undefined
    readonly removeLabel: string
    /** False when there is no uploaded picture to remove. */
    readonly canRemove: boolean
    readonly isBusy: boolean
    readonly onPick: (files: Array<File>) => void
    readonly onRemove: () => void
}

/** A profile picture editor: the live preview, a picker that uploads at once, and the action that removes the picture. */
export const AvatarEditor = (props: AvatarEditorProps) => (
    <div className={EDITOR_CLASS_NAME}>
        {props.preview}
        <div className={CONTROLS_CLASS_NAME}>
            <FileDropzone
                id={props.id}
                name={props.id}
                label={props.label}
                description={props.hint}
                prompt={props.prompt}
                accept={props.accept}
                hideFileList
                isDisabled={props.isBusy}
                isInvalid={props.error !== undefined}
                errorMessage={props.error}
                onFilesChange={props.onPick}
            />
            {props.canRemove ? (
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="secondary" size="sm" isDisabled={props.isBusy} onPress={props.onRemove}>
                        {props.removeLabel}
                    </Button>
                </div>
            ) : null}
        </div>
    </div>
)
