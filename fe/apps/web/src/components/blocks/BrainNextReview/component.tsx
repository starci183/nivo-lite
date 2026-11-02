import { Text, Link } from "@starci/grammar/common"

/** The line that sends the owner to the queue where the facts read from the documents wait. */
export interface BrainNextReviewBaseProps {
    readonly props: {
        readonly label: string
        readonly href: string
    }
}

/** Draws the one line that says what to do next after documents came in. */
export const BrainNextReviewBase = (props: BrainNextReviewBaseProps) => (
    <Text>
        <Link href={props.props.href}>{props.props.label}</Link>
    </Text>
)
