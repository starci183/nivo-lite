import { Button, Text } from "@starci/grammar/common"
import { NUDGE } from "./classNames"

/** Copy of the wait note. */
interface PromoLeadWaitBaseProps {
    readonly props: { readonly text: string; readonly seeLabel: string; readonly seeHref: string }
}

/** Draws the small note under the lead header: what the lead waited and a quiet link to the Chatbot. */
export const PromoLeadWaitBase = (props: PromoLeadWaitBaseProps) => (
    <div className={NUDGE} role="note">
        <Text size="sm" tone="muted">
            {props.props.text}
        </Text>
        <Button variant="ghost" size="sm" href={props.props.seeHref}>
            {props.props.seeLabel}
        </Button>
    </div>
)
