import { Alert, Button, CheckboxGroup, EmptyNotice, Section, type PresentationState } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
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
    readonly add: {
        readonly label: string
        readonly isPending: boolean
        readonly isDisabled: boolean
        /** Why adding waits, said on the disabled button; absent when it does not wait on the owner. */
        readonly disabledReason?: string
    }
}

/** The listing and the commands that act on it. */
export interface DriveListingBandProps {
    readonly isLoading?: boolean
    readonly listing: DriveListingView
    readonly on: {
        readonly select: (ids: ReadonlyArray<string>) => void
        readonly add: () => void
    }
}

/** Presents selectable folder files and the action to add the selected files. */
export const DriveListingBand = (props: DriveListingBandProps) => {
    const { listing } = props
    return (
        <Section
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            title={listing.title}
            meta={listing.count}
            headingLevel={3}
        >
            {listing.empty === undefined ? (
                <CheckboxGroup
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
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
                <EmptyNotice message={listing.empty.message} iconSource={nivoIconSource("document", "leading")} description={listing.empty.description} />
            )}
            {listing.notices.map((notice) => (
                <Alert
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    key={notice.id}
                    tone={notice.tone}

                    title={notice.title}
                />
            ))}
            {listing.empty === undefined ? (
                <>
                    <Button
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
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
        </Section>
    )
}
