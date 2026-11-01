import { Button } from "@starci/grammar/common"

/** Copy and values the commands of the Second Brain header supply. */
export interface BrainPageActionsBaseProps {
    readonly props: {
        /** Reviews every dossier again; null where the tab or the member does not offer it. */
        readonly review: { readonly label: string; readonly isRunning: boolean; readonly runningLabel: string } | null
        /** Where documents are added; null where the tab is that place or the member may only read. */
        readonly add: { readonly label: string; readonly href: string } | null
    }
    readonly on: { readonly review: () => void }
}

/** Draws the commands of the page at the end of its header row: review the whole set, and add documents. */
export const BrainPageActionsBase = (props: BrainPageActionsBaseProps) => (
    <>
        {props.props.review === null ? null : (
            <Button intent="neutral" isDisabled={props.props.review.isRunning} onPress={props.on.review}>
                {props.props.review.isRunning ? props.props.review.runningLabel : props.props.review.label}
            </Button>
        )}
        {props.props.add === null ? null : (
            <Button intent="commit" href={props.props.add.href}>
                {props.props.add.label}
            </Button>
        )}
    </>
)
