import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ListRegion, type ListRegionProps } from "@/components/composites/ListRegion"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** The card copy, its lines as a slot, and the retry. */
interface ProfileListRegionProps extends ProfileRegionBaseProps<ListRegionProps["rows"]> {}

/** Draws a list region of the agent profile page through its own read status. */
export const ProfileListRegion = (props: ProfileListRegionProps) => (
    <SlotView
        {...props.props.read}
        onRetry={props.on.retry}
        render={(rows, isSkeleton) => (
            <ListRegion
                label={props.props.label}
                rows={rows}
                count={props.props.count}
                isAttention={props.props.isAttention}
                action={props.props.action}
                empty={props.props.read.labels.empty}
                isLoading={isSkeleton}
            />
        )}
    />
)
