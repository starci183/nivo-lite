import { Alert, Button, EmptyNotice, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME, BLOCK_CLASS_NAME, CARD_CLASS_NAME } from "./classNames"

/** One parameter of a listing the buyer fills in. */
interface ParameterView {
    readonly key: string
    readonly label: string
    readonly value: string
}

/** One approved listing as the card draws it. */
interface ListingView {
    readonly id: string
    readonly name: string
    readonly summary: string
    readonly meta: string
    readonly priceLabel: string
    readonly isPaid: boolean
    readonly parameters: ReadonlyArray<ParameterView>
    readonly needs: string
}

/** The transfer to make for a paid listing. */
interface OrderView {
    readonly listingId: string
    readonly title: string
    readonly lines: ReadonlyArray<string>
    readonly qrUrl: string
}

/** Copy, values and state the connected marketplace supplies. */
export interface AgentMarketplaceBaseProps {
    readonly props: {
        readonly slot: DataSlot<ReadonlyArray<ListingView>>
        readonly placeholder: ReadonlyArray<ListingView>
        readonly slotLabels: SlotLabels
        readonly installLabel: string
        readonly orderLabel: string
        readonly order: OrderView | undefined
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly setValue: (listingId: string, key: string, value: string) => void
        readonly install: (listingId: string) => void
        readonly pay: (listingId: string) => void
    }
}

/** Draws the approved listings of the marketplace next to the built-in modules: what each does, what it costs, its settings and how to take it. */
export const AgentMarketplaceBase = (props: AgentMarketplaceBaseProps) => {
    const view = props.props
    return (
        <div className={BLOCK_CLASS_NAME}>
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.slotLabels}
                onRetry={props.on.retry}
                render={(listings, isLoading) => (
                    <>
                        {listings.length === 0 ? <EmptyNotice message={view.slotLabels.empty} /> : null}
                        {listings.map((listing) => (
                            <SurfaceCard key={listing.id} label={listing.name} headingLevel={2}>
                                <div className={CARD_CLASS_NAME}>
                                    <Text size="sm">{listing.summary}</Text>
                                    <Text size="xs" tone="muted">
                                        {listing.meta}
                                    </Text>
                                    <Text size="xs" tone="muted">
                                        {listing.needs}
                                    </Text>
                                    {listing.parameters.map((parameter) => (
                                        <Input
                                            key={parameter.key}
                                            id={`${listing.id}-${parameter.key}`}
                                            name={parameter.key}
                                            label={parameter.label}
                                            value={parameter.value}
                                            isDisabled={view.isPending || isLoading}
                                            onValueChange={(value) =>
                                                props.on.setValue(listing.id, parameter.key, value)
                                            }
                                        />
                                    ))}
                                    <div className={ACTIONS_CLASS_NAME}>
                                        <Text size="sm">{listing.priceLabel}</Text>
                                        {listing.isPaid ? (
                                            <Button
                                                intent="neutral"
                                                isPending={view.isPending}
                                                isDisabled={isLoading}
                                                onPress={() => props.on.pay(listing.id)}
                                            >
                                                {view.orderLabel}
                                            </Button>
                                        ) : null}
                                        <Button
                                            intent="alternative"
                                            isPending={view.isPending}
                                            isDisabled={isLoading}
                                            onPress={() => props.on.install(listing.id)}
                                        >
                                            {view.installLabel}
                                        </Button>
                                    </div>
                                    {view.order?.listingId === listing.id ? (
                                        <Alert
                                            tone="cautionary"
                                            title={view.order.title}
                                            description={view.order.lines.join(" | ")}
                                        />
                                    ) : null}
                                </div>
                            </SurfaceCard>
                        ))}
                    </>
                )}
            />
        </div>
    )
}
