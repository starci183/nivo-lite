import { Alert, IconTile } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** Copy and handler of the welcome band. */
export interface PromoWelcomeBandProps {
    readonly title: string
    readonly text: string
    readonly closeLabel: string
    readonly onClose: () => void
}

/**
 * Draws the first-run welcome of a Founding 50 member as a soft band over the conversation: the sparkle mark, the title and the
 * one next step, with a way to hide it. It carries no action of its own: the page has one primary, which starts the test.
 */
export const PromoWelcomeBand = (props: PromoWelcomeBandProps) => (
    <Alert
        tone="accent"
        title={props.title}
        description={props.text}
        leading={<IconTile source={nivoIconSource("sparkle", "leading")} tone="neutral" />}
        dismissLabel={props.closeLabel}
        onDismiss={props.onClose}
    />
)
