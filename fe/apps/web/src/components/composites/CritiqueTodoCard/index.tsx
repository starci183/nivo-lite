import { SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { CritiqueTodoView } from "@/modules/types"

/** Props for {@link CritiqueTodoCard}. */
interface CritiqueTodoCardProps {
    readonly props: { readonly critique: CritiqueTodoView }
    readonly on: { readonly retry: () => void }
}

/**
 * The documents whose critic's points wait: one row each with its count and a way to the page that answers them. A secondary region: it
 * collapses when empty and hides for a viewer who may not read it.
 */
export const CritiqueTodoCard = (props: CritiqueTodoCardProps) => {
    const { critique } = props.props
    return (
        <SlotView
            slot={critique.slot}
            placeholder={critique.placeholder}
            labels={critique.slotLabels}
            forbidden="hide"
            empty="collapse"
            onRetry={props.on.retry}
            render={(rows, isLoading) => (
                <SurfaceCard
                    kind="list"
                    label={critique.label}
                    ariaLabel={critique.listLabel}
                    count={rows.length}
                    isAttention
                    isLoading={isLoading}
                    items={rows.map((row) => ({
                        id: row.id,
                        title: row.title,
                        description: (
                            <Text as="span" size="xs" tone="muted">
                                {row.line}
                            </Text>
                        ),
                        ...(row.badge === null
                            ? {}
                            : { badges: [{ label: row.badge, tone: "neutral" as const }] as const }),
                        actionPlacement: "end" as const,
                        action: { label: critique.open, href: row.href },
                    }))}
                    empty={null}
                />
            )}
        />
    )
}
