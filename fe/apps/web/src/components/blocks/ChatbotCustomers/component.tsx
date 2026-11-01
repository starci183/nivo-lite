import {
    Badge,
    EmptyNotice,
    ListRow,
    SearchField,
    SurfaceListCard,
    TagGroup,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One customer as a row of the list, already worded. */
interface CustomerRowView {
    readonly id: string
    /** The conversation the row opens in the inbox. */
    readonly href: string
    readonly name: string
    readonly summary: string
    readonly stage: string | null
    readonly status: { readonly label: string; readonly tone: BadgeTone }
}

/** The words of the tab. */
interface ChatbotCustomersWords {
    readonly label: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly filtersLabel: string
    readonly emptyMessage: string
    readonly emptyDescription: string
    readonly full: string
}

/** Props for {@link ChatbotCustomersBase}. */
export interface ChatbotCustomersBaseProps {
    readonly props: {
        readonly words: ChatbotCustomersWords
        readonly slot: DataSlot<ReadonlyArray<CustomerRowView>>
        readonly slotLabels: SlotLabels
        readonly query: string
        readonly filter: string
        readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string }>
        /** True when the list is as long as the overview carries, so older customers may be missing. */
        readonly isFull: boolean
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly filter: (id: string) => void
        readonly retry: () => void
    }
}

const PLACEHOLDER: ReadonlyArray<CustomerRowView> = [
    { id: "loading", href: "", name: "", summary: "", stage: null, status: { label: "", tone: "neutral" } },
]

/** Draws the customers being handled: a search, the chips and one row per customer with where the conversation stands; a row opens its conversation. */
export const ChatbotCustomersBase = (props: ChatbotCustomersBaseProps) => {
    const words = props.props.words
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(rows, isSkeleton) => (
                <>
                    <SearchField
                        label={words.searchLabel}
                        isLabelHidden
                        placeholder={words.searchPlaceholder}
                        clearLabel={words.clearLabel}
                        value={props.props.query}
                        onValueChange={props.on.query}
                        isSkeleton={isSkeleton}
                    />
                    <TagGroup
                        label={words.filtersLabel}
                        selectionMode="single"
                        size="sm"
                        isSkeleton={isSkeleton}
                        items={props.props.chips}
                        selectedIds={[props.props.filter]}
                        onSelectionChange={(ids) => {
                            const picked = ids[0]
                            if (picked !== undefined) props.on.filter(picked)
                        }}
                    />
                    <SurfaceListCard
                        label={words.label}
                        labelHidden
                        empty={<EmptyNotice message={words.emptyMessage} description={words.emptyDescription} />}
                        footer={
                            props.props.isFull ? (
                                <Text size="sm" tone="muted">
                                    {words.full}
                                </Text>
                            ) : undefined
                        }
                    >
                        {rows.map((row) => (
                            <ListRow
                                key={row.id}
                                isSkeleton={isSkeleton}
                                title={
                                    <TextAction appearance="plain" href={row.href}>
                                        {row.name}
                                    </TextAction>
                                }
                                description={row.summary}
                                badges={
                                    <>
                                        <Badge tone={row.status.tone} isDot>
                                            {row.status.label}
                                        </Badge>
                                        {row.stage === null ? null : <Badge tone="neutral">{row.stage}</Badge>}
                                    </>
                                }
                            />
                        ))}
                    </SurfaceListCard>
                </>
            )}
        </SlotView>
    )
}
