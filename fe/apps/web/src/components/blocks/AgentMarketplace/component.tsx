import { Alert, Button, Dialog, EmptyNotice, Grid, Section, Stack, SurfaceCard } from "@starci/grammar/common"
import { cloneElement, isValidElement, type ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ParameterField, type ParameterView } from "./parameters"

/** The notice of a slot that is empty, forbidden or failed, set bare on the page ground (a notice on the well has no frame). */
const framelessNotice = (notice: ReactNode): ReactNode =>
    isValidElement<{ readonly frame?: "card" | "frameless" }>(notice)
        ? cloneElement(notice, { frame: "frameless" })
        : notice

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
        readonly sectionTitle: string
        /** The muted line under the empty answer: when a template shows here. */
        readonly emptyHint: string
        readonly installLabel: string
        readonly orderLabel: string
        readonly cancelLabel: string
        /** The listing whose install dialog (its parameters, then the install command) is open, or null. */
        readonly installingId: string | null
        readonly order: OrderView | undefined
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly openInstall: (listingId: string | null) => void
        readonly setValue: (listingId: string, key: string, value: string) => void
        readonly install: (listingId: string) => void
        readonly pay: (listingId: string) => void
    }
}

/** The tile of one listing: its name and author line, what it does and needs, its price chip and the one command that takes it. */
interface ListingTileProps extends AgentMarketplaceBaseProps {
    readonly listing: ListingView
    readonly isLoading: boolean
}

const ListingTile = (props: ListingTileProps) => {
    const { listing, isLoading } = props
    const view = props.props
    const installCommand = { label: view.installLabel, press: () => props.on.openInstall(listing.id) }
    return (
        <SurfaceCard
            kind="tile"
            name={listing.name}
            mark={{ avatar: { name: listing.name, kind: "agent" } }}
            description={listing.summary}
            facts={`${listing.meta} · ${listing.needs}`}
            badge={{ label: listing.priceLabel, tone: listing.isPaid ? "warning" : "success" }}
            isLoading={isLoading}
            action={
                listing.isPaid
                    ? {
                          label: view.orderLabel,
                          intent: "neutral",
                          isPending: view.isPending,
                          press: () => props.on.pay(listing.id),
                      }
                    : {
                          label: installCommand.label,
                          intent: "neutral",
                          isPending: view.isPending,
                          press: installCommand.press,
                      }
            }
            {...(listing.isPaid
                ? {
                      menu: {
                          label: view.installLabel,
                          entries: [{ id: "install", label: view.installLabel, onAction: installCommand.press }],
                      },
                  }
                : {})}
        />
    )
}

/** The dialog that asks for the values of the listing (its parameters), then installs it in trial mode. */
interface InstallDialogProps extends AgentMarketplaceBaseProps {
    readonly listings: ReadonlyArray<ListingView>
}

const InstallDialog = (props: InstallDialogProps) => {
    const view = props.props
    const listing = props.listings.find((entry) => entry.id === view.installingId)
    if (listing === undefined) return null
    return (
        <Dialog
            isOpen
            onOpenChange={() => props.on.openInstall(null)}
            isDismissable={!view.isPending}
            size="sm"
            title={listing.name}
            description={listing.summary}
            closeLabel={view.cancelLabel}
            footer={
                <>
                    <Button intent="neutral" isDisabled={view.isPending} onPress={() => props.on.openInstall(null)}>
                        {view.cancelLabel}
                    </Button>
                    <Button intent="commit" isPending={view.isPending} onPress={() => props.on.install(listing.id)}>
                        {view.installLabel}
                    </Button>
                </>
            }
        >
            <Stack gap="row">
                {listing.parameters.map((parameter) => (
                    <ParameterField
                        key={parameter.key}
                        parameter={parameter}
                        isDisabled={view.isPending}
                        onValue={(value) => props.on.setValue(listing.id, parameter.key, value)}
                    />
                ))}
            </Stack>
        </Dialog>
    )
}

/** Draws the approved listings as tiles: what each does, what it costs and needs, and how to take it; its values are asked in a dialog and a paid one shows its transfer. */
export const AgentMarketplaceBase = (props: AgentMarketplaceBaseProps) => {
    const view = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            onRetry={props.on.retry}
            frame={framelessNotice}
            render={(listings, isLoading) => (
                <Stack gap="section">
                    <Section title={view.sectionTitle} headingLevel={2} count={listings.length} isLoading={isLoading}>
                        {listings.length === 0 ? (
                            <EmptyNotice
                                frame="card"
                                message={view.slotLabels.empty}
                                description={view.emptyHint}
                                iconSource={nivoIconSource("explore", "leading")}
                            />
                        ) : (
                            <Grid kind="cards" columns={3}>
                                {listings.map((listing) => (
                                    <ListingTile key={listing.id} {...props} listing={listing} isLoading={isLoading} />
                                ))}
                            </Grid>
                        )}
                    </Section>
                    {view.order === undefined ? null : (
                        <Alert tone="cautionary" title={view.order.title} description={view.order.lines.join(" | ")} />
                    )}
                    <InstallDialog {...props} listings={listings} />
                </Stack>
            )}
        />
    )
}
