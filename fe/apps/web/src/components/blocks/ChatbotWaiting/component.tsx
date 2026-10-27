import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One conversation that waits for a person. */
interface WaitingRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly href: string
}

/** What the waiting card shows once read. */
export interface ChatbotWaitingView {
    /** The count badge; null when nothing waits. */
    readonly count: string | null
    readonly rows: ReadonlyArray<WaitingRowView>
    readonly openLabel: string
    readonly more: string | null
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** Fake data of the same shape: the skeleton draws the card around one row. */
const WAITING_PLACEHOLDER: ChatbotWaitingView = {
    count: null,
    rows: [{ id: "loading", title: "", description: "", href: "" }],
    openLabel: "",
    more: null,
    emptyMessage: "",
    emptyDescription: "",
}

/** Props for {@link ChatbotWaitingBase}. */
export interface ChatbotWaitingBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<ChatbotWaitingView>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the "waiting for you" card of the Chatbot workbench: the conversations that wait for a person. */
export const ChatbotWaitingBase = (props: ChatbotWaitingBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={WAITING_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => (
            <SurfaceListCard
                label={props.props.label}
                isLoading={isSkeleton}
                labelEnd={
                    view.count === null ? undefined : (
                        <Badge tone="warning" isDot>
                            {view.count}
                        </Badge>
                    )
                }
                empty={<EmptyNotice message={view.emptyMessage} description={view.emptyDescription} />}
                footer={
                    view.more === null ? undefined : (
                        <Text size="sm" tone="muted">
                            {view.more}
                        </Text>
                    )
                }
            >
                {view.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        description={row.description}
                        actions={
                            <Button size="sm" intent="neutral" href={row.href}>
                                {view.openLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
        )}
    </SlotView>
)
