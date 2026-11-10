import { Button, DropdownMenu, IconButton } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView } from "@/modules/types"

/** The checklist import as the head draws it: a plain command with the upload glyph. */
interface DossierImportEntry {
    readonly label: string
    readonly onPress: () => void
}

/** What the head of the dossiers tab draws. */
interface DossierHeaderActionsProps {
    /** The import of a checklist; null for a member who may only read. */
    readonly importEntry: DossierImportEntry | null
    /** The whole-set review in the options menu; null for a member who may only read. */
    readonly review: BrainPageHeaderView["actions"]["review"]
    readonly onReview: () => void
}

/**
 * The commands of the dossiers tab on the head band: loading a checklist is a plain command (it never competes with a decision)
 * and reviewing the whole set sits in the options menu.
 */
export const DossierHeaderActions = (props: DossierHeaderActionsProps) => (
    <>
        {props.importEntry === null ? null : (
            <Button
                intent="alternative"
                size="sm"
                onPress={props.importEntry.onPress}
            >
                {props.importEntry.label}
            </Button>
        )}
        {props.review === null ? null : (
            <DropdownMenu
                placement="bottom end"
                entries={[
                    {
                        id: "review",
                        label: props.review.isRunning ? props.review.runningLabel : props.review.label,
                        onAction: props.onReview,
                    },
                ]}
                trigger={
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("more", "leading")}
                        label={props.review.menuLabel}
                        isPending={props.review.isRunning || props.review.isPending}
                    />
                }
            />
        )}
    </>
)
