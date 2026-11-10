import { Button, Cluster, FileButton, Stack, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the picture editor draws and does. */
type AvatarEditorProps = {
    /** The live preview: the chosen picture while it uploads, else the saved one or the generated avatar. */
    readonly preview: ReactNode
    /** The accessible name of the picker. */
    readonly label: string
    /** The visible word of the picker ("Change picture"). */
    readonly pickLabel: string
    readonly hint: string
    readonly accept: string
    /** Why the chosen picture was refused, or undefined. */
    readonly error?: string | undefined
    readonly removeLabel: string
    /** Draws the remove pill as a small neutral one (a reset beside the picker) instead of the alternative pill. */
    readonly isRemoveCompact?: boolean
    /** False when there is no uploaded picture to remove. */
    readonly canRemove: boolean
    readonly isBusy: boolean
    /** The account read has no data yet: the pills draw as geometry (the remove pill keeps its place). */
    readonly isLoading: boolean
    readonly onPick: (files: Array<File>) => void
    readonly onRemove: () => void
}

/**
 * A profile picture editor: the live preview, the picker pill that uploads at once, the pill that removes the picture and the
 * line of what is accepted (the refusal replaces it). The pills are geometry while the account loads.
 */
export const AvatarEditor = (props: AvatarEditorProps) => (
    <Cluster gap="row" align="start">
        {props.preview}
        <Stack gap="inline">
            <Cluster gap="inline">
                <FileButton
                    label={props.label}
                    source={nivoIconSource("upload", "leading")}
                    text={props.pickLabel}
                    accept={props.accept}
                    isDisabled={props.isBusy}
                    isLoading={props.isLoading}
                    {...(props.error === undefined ? {} : { errorMessage: props.error })}
                    onFilesChange={props.onPick}
                />
                {props.canRemove || props.isLoading ? (
                    <Button
                        intent={props.isRemoveCompact === true ? "neutral" : "alternative"}
                        {...(props.isRemoveCompact === true ? { size: "sm" as const } : {})}
                        isDisabled={props.isBusy}
                        isLoading={props.isLoading}
                        onPress={props.onRemove}
                    >
                        {props.removeLabel}
                    </Button>
                ) : null}
            </Cluster>
            {props.error === undefined ? (
                <Text size="xs" tone="muted">
                    {props.hint}
                </Text>
            ) : null}
        </Stack>
    </Cluster>
)
