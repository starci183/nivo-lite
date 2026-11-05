import {
    Alert,
    Button,
    Dialog,
    EmptyNotice,
    Grid,
    Input,
    NumberField,
    Stack,
    SurfaceCard,
    Switch,
    Textarea,
} from "@starci/grammar/common"
import { AGENT_MARK_MASCOT_SRC } from "@/components/leaves/AgentMark"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One parameter of a listing the buyer fills in. */
interface ParameterView {
    readonly key: string
    readonly label: string
    readonly value: string
    /** The type of the field: a number, one line of text, several lines, or a switch. */
    readonly kind: "number" | "text" | "toggle" | "textarea"
    readonly hint: string
    readonly min: number | null
    readonly max: number | null
    /** What is wrong with the value, in words; empty while it is fine (or not yet asked for). */
    readonly error: string
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
            mark={{ avatar: { name: listing.name, kind: "agent", src: AGENT_MARK_MASCOT_SRC } }}
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

/** What one typed field of a listing draws. */
interface ParameterFieldProps {
    readonly id: string
    readonly parameter: ParameterView
    readonly isDisabled: boolean
    readonly onValue: (value: string) => void
}

/** One parameter as the field its type calls for: a number with its bounds, a switch, a few lines or one line; each says what is wrong in place. */
const ParameterField = (props: ParameterFieldProps) => {
    const { parameter } = props
    const fieldId = `${props.id}-${parameter.key}`
    const error = parameter.error === "" ? undefined : parameter.error
    if (parameter.kind === "toggle") {
        return (
            <Switch
                name={fieldId}
                label={parameter.label}
                isSelected={parameter.value === "true"}
                isDisabled={props.isDisabled}
                onSelectedChange={(on) => props.onValue(String(on))}
            />
        )
    }
    if (parameter.kind === "number") {
        return (
            <NumberField
                label={parameter.label}
                description={parameter.hint === "" ? undefined : parameter.hint}
                {...(parameter.min === null ? {} : { minValue: parameter.min })}
                {...(parameter.max === null ? {} : { maxValue: parameter.max })}
                {...(parameter.value === "" ? {} : { value: Number(parameter.value) })}
                isInvalid={error !== undefined}
                errorMessage={error}
                isDisabled={props.isDisabled}
                onValueChange={(value) => props.onValue(Number.isNaN(value) ? "" : String(value))}
            />
        )
    }
    const Field = parameter.kind === "textarea" ? Textarea : Input
    return (
        <Field
            id={fieldId}
            name={parameter.key}
            label={parameter.label}
            description={parameter.hint === "" ? undefined : parameter.hint}
            value={parameter.value}
            isInvalid={error !== undefined}
            errorMessage={error}
            isDisabled={props.isDisabled}
            onValueChange={props.onValue}
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
                        id={listing.id}
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
            render={(listings, isLoading) => (
                <Stack gap="section">
                    {listings.length === 0 ? <EmptyNotice message={view.slotLabels.empty} /> : null}
                    <Grid kind="cards" columns={3}>
                        {listings.map((listing) => (
                            <ListingTile key={listing.id} {...props} listing={listing} isLoading={isLoading} />
                        ))}
                    </Grid>
                    {view.order === undefined ? null : (
                        <Alert tone="cautionary" title={view.order.title} description={view.order.lines.join(" | ")} />
                    )}
                    <InstallDialog {...props} listings={listings} />
                </Stack>
            )}
        />
    )
}
