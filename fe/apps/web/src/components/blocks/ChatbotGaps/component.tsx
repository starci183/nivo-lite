import { Badge, Button, ListRow, SurfaceListCard, TextAction, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One unanswered question, already worded. */
interface GapRowView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: "neutral" | "warning" }>
    readonly answerLabel: string
    readonly answerHref: string
    readonly dismissLabel: string
}

const GAPS_PLACEHOLDER: ReadonlyArray<GapRowView> = [
    { id: "loading", title: "", line: "", badges: [], answerLabel: "", answerHref: "", dismissLabel: "" },
]

/** Props for {@link ChatbotGapsBase}. */
export interface ChatbotGapsBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly slot: DataSlot<ReadonlyArray<GapRowView>>
        readonly slotLabels: SlotLabels
        /** A dismissal is in flight. */
        readonly isPending: boolean
    }
    readonly on: {
        readonly reload: () => void
        readonly dismiss: (id: string) => void
    }
}

/** Draws the questions the Chatbot could not answer, each with the brain link that answers it and a dismiss. */
export const ChatbotGapsBase = (props: ChatbotGapsBaseProps) => {
    const p = props.props
    return (
        <SurfaceListCard
            label={p.title}
            headingLevel={2}
            isLoading={p.slot.isLoading === true}
            footer={
                <Text size="sm" tone="muted">
                    {p.description}
                </Text>
            }
        >
            <SlotView slot={p.slot} placeholder={GAPS_PLACEHOLDER} labels={p.slotLabels} onRetry={props.on.reload}>
                {(rows) =>
                    rows.map((row) => (
                        <ListRow
                            key={row.id}
                            title={row.title}
                            description={row.line}
                            badges={
                                <>
                                    {row.badges.map((badge) => (
                                        <Badge key={badge.label} tone={badge.tone}>
                                            {badge.label}
                                        </Badge>
                                    ))}
                                </>
                            }
                            actions={
                                <>
                                    <Text>
                                        <TextAction href={row.answerHref}>{row.answerLabel}</TextAction>
                                    </Text>
                                    <Button
                                        intent="neutral"
                                        isPending={p.isPending}
                                        onPress={() => props.on.dismiss(row.id)}
                                    >
                                        {row.dismissLabel}
                                    </Button>
                                </>
                            }
                        />
                    ))
                }
            </SlotView>
        </SurfaceListCard>
    )
}
