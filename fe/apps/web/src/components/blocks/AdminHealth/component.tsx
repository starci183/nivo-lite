import { PageHeader } from "@starci/grammar/common"
import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import { GRID_CLASS_NAME } from "./classNames"
import { SlotView } from "@/components/composites/SlotView"
import type { AdminCardView, DataSlot, SlotLabels } from "@/modules/types"

/** Copy and cards the platform health page supplies. */
export interface AdminHealthViewProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly cards: ReadonlyArray<AdminCardView>
    }
}

/** The health page with the skeleton flag the slot hands down. */
type AdminHealthDrawProps = AdminHealthViewProps & { readonly isSkeleton: boolean }

/** Draws the platform health page: sign-ups, billing, application errors and console activity as list cards. */
const AdminHealthView = (props: AdminHealthDrawProps) => (
    <>
        <PageHeader
            measure="full"
            meta={props.props.eyebrow}
            title={props.props.title}
            description={props.props.description}
            isSkeleton={props.isSkeleton}
        />
        <div className={GRID_CLASS_NAME}>
            {props.props.cards.map((card) => (
                <AdminRowsCard key={card.id} card={card} isSkeleton={props.isSkeleton} />
            ))}
        </div>
    </>
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

/** Draws the finished health view, or the same view as a skeleton, the failure with its retry, or the empty notice. */
export const AdminHealthBase = (props: AdminHealthBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => <AdminHealthView props={view} isSkeleton={isSkeleton} />}
    </SlotView>
)
