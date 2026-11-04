import { Grid, Page } from "@starci/grammar/common"
import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { AdminCardView, DataSlot, SlotLabels } from "@/modules/types"

/** Copy and cards the platform health page supplies. */
export interface AdminHealthViewProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly cards: ReadonlyArray<AdminCardView>
    }
}

/** The health page with the skeleton flag the slot hands down. */
type AdminHealthDrawProps = AdminHealthViewProps & { readonly isLoading: boolean }

/** Draws the platform health body: sign-ups, billing, application errors and console activity as list cards. */
const AdminHealthView = (props: AdminHealthDrawProps) => (
    <Grid kind="sections">
        {props.props.cards.map((card) => (
            <AdminRowsCard key={card.id} card={card} isLoading={props.isLoading} />
        ))}
    </Grid>
)

/** The health read as a slot, its same-shape placeholder, and the words of its states. */
export interface AdminHealthBaseProps {
    readonly props: {
        readonly slot: DataSlot<AdminHealthViewProps["props"]>
        readonly placeholder: AdminHealthViewProps["props"]
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the health page: its header band from the words, over the finished view, or the same view as a skeleton, the failure with its retry, or the empty notice. */
export const AdminHealthBase = (props: AdminHealthBaseProps) => {
    const words = props.props.placeholder
    return (
        <Page measure="full" header={{ title: words.title, description: words.description }}>
            <SlotView
                {...props.props}
                onRetry={props.on.retry}
                render={(view, isLoading) => <AdminHealthView props={view} isLoading={isLoading} />}
            />
        </Page>
    )
}
