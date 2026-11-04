import { IconButton } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the aside head draws. */
interface LeadAsideHeadProps {
    readonly title: string
    readonly closeLabel: string
    readonly onClose: () => void
}

/** The head of the customer-information aside: its title and the control that hides it. */
export const LeadAsideHead = (props: LeadAsideHeadProps) => (
    <PaneHead
        title={props.title}
        actions={
            <IconButton
                intent="neutral"
                source={nivoIconSource("close", "leading")}
                label={props.closeLabel}
                onPress={props.onClose}
            />
        }
    />
)
