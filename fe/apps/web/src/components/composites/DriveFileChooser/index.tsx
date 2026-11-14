import { Alert, Button, Input, Grid } from "@starci/grammar/common"
import { DriveListingBand, type DriveListingBandProps } from "@/components/branches/DriveListingBand"

/** The `isLoading` prop, spread only when the caller states it (an absent flag stays absent). */
const loadingOf = (isLoading: boolean | undefined) => (isLoading === undefined ? {} : { isLoading })

/** Props for {@link DriveFileChooser}. */
type DriveFileChooserProps = {
    readonly props: {
        readonly isLoading?: boolean

        readonly link: {
            readonly label: string
            readonly placeholder: string
            readonly description: string
            readonly value: string
            readonly readLabel: string
            readonly isReading: boolean
        }
        /** The Google Picker command; absent where the console has no Picker keys, and the link carries the step. */
        readonly pickLabel?: string
        /** Why the last read or add did not work, worded by the back end; empty when there is none. */
        readonly error: string
        readonly listing?: DriveListingBandProps["listing"]
        /** What the last add did, over the list; empty when nothing was added yet. */
        readonly added: string
    }
    readonly on: {
        readonly changeLink: (value: string) => void
        readonly read: () => void
        readonly pick: () => void
        readonly select: (ids: ReadonlyArray<string>) => void
        readonly add: () => void
    }
}

/**
 * The choose step of Google Drive: the folder link with its read command (and Google Picker where the console has it), the files read
 * from the folder as a ticked list, and the one command that adds them. Used by the page and by the hub wizard.
 */
export const DriveFileChooser = (props: DriveFileChooserProps) => {
    const { link, listing } = props.props
    return (
        <>
            {props.props.pickLabel === undefined ? null : (
                <Button
                    {...loadingOf(props.props.isLoading)}
                    intent="neutral"
                    onPress={props.on.pick}
                >
                    {props.props.pickLabel}
                </Button>
            )}
            <Grid kind="form" columns={1}>
                <Input
                    {...loadingOf(props.props.isLoading)}
                    id="drive-folder-link"
                    name="driveFolderLink"
                    label={link.label}
                    description={link.description}
                    placeholder={link.placeholder}
                    value={link.value}
                    onValueChange={props.on.changeLink}
                />
            </Grid>
            <Button
                {...loadingOf(props.props.isLoading)}
                intent="neutral"
                isPending={link.isReading}
                isDisabled={link.value.trim() === ""}
                onPress={props.on.read}
            >
                {link.readLabel}
            </Button>
            {props.props.error === "" ? null : (
                <Alert
                    {...loadingOf(props.props.isLoading)}
                    tone="negative"

                    title={props.props.error}
                />
            )}
            {props.props.added === "" ? null : (
                <Alert
                    {...loadingOf(props.props.isLoading)}
                    tone="affirmative"

                    title={props.props.added}
                />
            )}
            {listing === undefined ? null : (
                <DriveListingBand
                    {...loadingOf(props.props.isLoading)}
                    listing={listing}
                    on={props.on}
                />
            )}
        </>
    )
}
