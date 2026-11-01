import {
    Alert,
    Button,
    CheckboxGroup,
    EmptyNotice,
    FormGrid,
    Input,
    RadioGroup,
    SectionHeader,
} from "@starci/grammar/common"
import type { PresentationState } from "@starci/grammar/common"

/** One file the owner can tick: its name, the line under it, and whether NIVO can read it at all. */
interface DriveFileChoice {
    readonly value: string
    readonly label: string
    readonly description: string
    readonly isDisabled: boolean
}

/** The files read from a folder, and what the owner decides about them. */
interface DriveListingView {
    /** The folder name and how many files are ticked, over the list. */
    readonly title: string
    readonly count: string
    readonly filesLabel: string
    readonly files: ReadonlyArray<DriveFileChoice>
    readonly selected: ReadonlyArray<string>
    /** Why the list is not the whole folder (the 300-file limit). */
    readonly notices: ReadonlyArray<{ readonly id: string; readonly tone: PresentationState; readonly title: string }>
    /** Google would not list the picked folder: the owner picks the files inside it. */
    readonly empty?: { readonly message: string; readonly description: string }
    readonly visibility: {
        readonly label: string
        readonly description: string
        /** The audience chosen; null until the owner chooses. */
        readonly value: string | null
        readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
    }
    readonly add: {
        readonly label: string
        readonly isPending: boolean
        readonly isDisabled: boolean
        /** Why adding waits, said on the disabled button; absent when it does not wait on the owner. */
        readonly disabledReason?: string
    }
}

/** Props for {@link DriveFileChooser}. */
type DriveFileChooserProps = {
    readonly props: {
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
        readonly listing?: DriveListingView
        /** What the last add did, over the list; empty when nothing was added yet. */
        readonly added: string
    }
    readonly on: {
        readonly changeLink: (value: string) => void
        readonly read: () => void
        readonly pick: () => void
        readonly select: (ids: ReadonlyArray<string>) => void
        readonly changeVisibility: (value: string) => void
        readonly add: () => void
    }
}

/** The listing and the commands that act on it. */
interface ListingBandProps {
    readonly listing: DriveListingView
    readonly on: DriveFileChooserProps["on"]
}

const ListingBand = (props: ListingBandProps) => {
    const { listing } = props
    return (
        <>
            <SectionHeader level={3} title={listing.title} meta={listing.count} />
            {listing.empty === undefined ? (
                <CheckboxGroup
                    label={listing.filesLabel}
                    isLabelHidden
                    name="drive-files"
                    options={listing.files.map((file) => ({
                        value: file.value,
                        label: file.label,
                        description: file.description,
                        isDisabled: file.isDisabled,
                    }))}
                    value={listing.selected}
                    onValueChange={props.on.select}
                />
            ) : (
                <EmptyNotice message={listing.empty.message} description={listing.empty.description} />
            )}
            {listing.notices.map((notice) => (
                <Alert key={notice.id} tone={notice.tone} appearance="soft" title={notice.title} />
            ))}
            {listing.empty === undefined ? (
                <>
                    <RadioGroup
                        label={listing.visibility.label}
                        description={listing.visibility.description}
                        name="drive-visibility"
                        orientation="horizontal"
                        options={listing.visibility.options}
                        value={listing.visibility.value}
                        onValueChange={props.on.changeVisibility}
                    />
                    <Button
                        intent="commit"
                        isPending={listing.add.isPending}
                        isDisabled={listing.add.isDisabled}
                        {...(listing.add.disabledReason === undefined
                            ? {}
                            : { disabledReason: listing.add.disabledReason })}
                        onPress={props.on.add}
                    >
                        {listing.add.label}
                    </Button>
                </>
            ) : null}
        </>
    )
}

/**
 * The choose step of Google Drive: the folder link with its read command (and Google Picker where the console has it), the files read
 * from the folder as a ticked list, who may use them, and the one command that adds them. Used by the page and by the hub wizard.
 */
export const DriveFileChooser = (props: DriveFileChooserProps) => {
    const { link, listing } = props.props
    return (
        <>
            {props.props.pickLabel === undefined ? null : (
                <Button intent="neutral" onPress={props.on.pick}>
                    {props.props.pickLabel}
                </Button>
            )}
            <FormGrid columns={1}>
                <Input
                    id="drive-folder-link"
                    name="driveFolderLink"
                    label={link.label}
                    description={link.description}
                    placeholder={link.placeholder}
                    value={link.value}
                    onValueChange={props.on.changeLink}
                />
            </FormGrid>
            <Button
                intent="neutral"
                isPending={link.isReading}
                isDisabled={link.value.trim() === ""}
                onPress={props.on.read}
            >
                {link.readLabel}
            </Button>
            {props.props.error === "" ? null : <Alert tone="negative" appearance="soft" title={props.props.error} />}
            {props.props.added === "" ? null : <Alert tone="affirmative" appearance="soft" title={props.props.added} />}
            {listing === undefined ? null : <ListingBand listing={listing} on={props.on} />}
        </>
    )
}
