import { Button } from "@starci/grammar/common"
import { FilterButtons } from "@/components/leaves/FilterButtons"
import type { BrainPageHeaderView } from "@/modules/types"

/** The resolved controls of the Second Brain header. */
interface BrainPageActionsProps {
    readonly part: BrainPageHeaderView["actions"]["part"]
    readonly review: BrainPageHeaderView["actions"]["review"]
    readonly add: BrainPageHeaderView["actions"]["add"]
    readonly onReview: () => void
    readonly onSetPart: (id: string) => void
}

/** Draws the part switch, review-all command and add destination at their existing header placement. */
export const BrainPageActions = (props: BrainPageActionsProps) => (
    <>
        <FilterButtons
            label={props.part.label}
            options={props.part.options}
            value={props.part.value}
            onValueChange={props.onSetPart}
        />
        {props.review === null ? null : (
            <Button
                intent="neutral"
                isPending={props.review.isRunning || props.review.isPending}
                onPress={props.onReview}
            >
                {props.review.isRunning ? props.review.runningLabel : props.review.label}
            </Button>
        )}
        {props.add === null ? null : (
            <Button intent="commit" href={props.add.href}>
                {props.add.label}
            </Button>
        )}
    </>
)
