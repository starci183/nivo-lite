import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { AccountingPanelBaseProps } from "@/modules/types"

/** One due of the list: what falls due, when, and how near it is. */
interface UpcomingRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: string
    readonly tone: "danger" | "warning" | "neutral"
}

/** The resolved words and rows of the Upcoming card. */
export interface AccountingUpcomingView {
    readonly title: string
    readonly rows: ReadonlyArray<UpcomingRowView>
    /** True when the Brain holds no tax profile: the list cannot be known, so the card says what it needs. */
    readonly isUnknown: boolean
    readonly emptyMessage: string
    readonly emptyBody: string
    readonly openBrainLabel: string
    /** Says the list holds tax only because no invoice connector answers; null when it does not. */
    readonly note: string | null
}

/** What the card does. */
export interface AccountingUpcomingOn {
    readonly openBrain: () => void
}

/** Props for {@link AccountingUpcomingBase}: the card read status, its placeholder of the same shape and what it does. */
export type AccountingUpcomingBaseProps = AccountingPanelBaseProps<AccountingUpcomingView, AccountingUpcomingOn>

/** Draws the dues of the next days: tax deadlines and supplier invoices, each with the days left. */
export const AccountingUpcomingBase = (props: AccountingUpcomingBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => (
            <SurfaceListCard
                label={view.title}
                isLoading={isSkeleton}
                empty={
                    <EmptyNotice
                        message={view.emptyMessage}
                        description={view.emptyBody}
                        {...(view.isUnknown ? { actionLabel: view.openBrainLabel, onAction: props.on.openBrain } : {})}
                    />
                }
                footer={
                    view.note === null ? undefined : (
                        <Text size="sm" tone="muted">
                            {view.note}
                        </Text>
                    )
                }
            >
                {view.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        description={row.description}
                        badges={<Badge tone={row.tone}>{row.badge}</Badge>}
                    />
                ))}
            </SurfaceListCard>
        )}
    </SlotView>
)
