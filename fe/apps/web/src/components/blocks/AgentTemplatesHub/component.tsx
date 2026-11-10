import {
    Alert,
    Button,
    Dialog,
    EmptyNotice,
    Input,
    Stack,
    SurfaceCard,
    Textarea,
    type ListRowData,
} from "@starci/grammar/common"
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The notice of a slot that is empty, forbidden or failed, set bare on the page ground (a notice on the well has no frame). */
const framelessNotice = (notice: ReactNode): ReactNode =>
    isValidElement<{ readonly frame?: "card" | "frameless" }>(notice)
        ? cloneElement(notice, { frame: "frameless" })
        : notice

/** One saved version of a template as the hub draws it. */
interface VersionView {
    readonly version: number
    readonly line: string
}

/** One template of the caller. */
interface TemplateView {
    readonly key: string
    readonly name: string
    readonly versions: ReadonlyArray<VersionView>
}

/** One newer version offered to an installation. */
interface OfferView {
    readonly installationId: string
    readonly title: string
    readonly changelog: string
    readonly safeUnitIds: ReadonlyArray<string>
    readonly units: ReadonlyArray<{ readonly id: string; readonly line: string }>
}

/** The data the hub reads. */
export interface AgentTemplatesHubData {
    readonly templates: ReadonlyArray<TemplateView>
    readonly offers: ReadonlyArray<OfferView>
}

/** The words of the hub. */
interface HubCopy {
    readonly mineTitle: string
    readonly offersTitle: string
    readonly valuesLabel: string
    readonly valuesHint: string
    readonly priceLabel: string
    readonly importLabel: string
    readonly submitLabel: string
    readonly acceptSafeLabel: string
    readonly acceptUnitLabel: string
    readonly noOffers: string
    readonly cancelLabel: string
    readonly moreLabel: string
}

/** The commands of the hub. */
interface HubCommands {
    readonly importVersion: (key: string, version: number) => void
    readonly submitVersion: (key: string, version: number) => void
    readonly accept: (installationId: string, unitIds: Array<string>) => void
}

/** The version a command dialog is open for: importing it here (its values) or offering it on the marketplace (its price). */
export interface HubDialog {
    readonly kind: "import" | "submit"
    readonly key: string
    readonly version: number
}

/** Copy, values and state the connected hub supplies. */
export interface AgentTemplatesHubBaseProps {
    readonly props: HubCopy & {
        readonly slot: DataSlot<AgentTemplatesHubData>
        readonly placeholder: AgentTemplatesHubData
        readonly slotLabels: SlotLabels
        readonly valuesText: string
        readonly price: string
        readonly notice: string | undefined
        readonly isPending: boolean
        readonly dialog: HubDialog | null
    }
    readonly on: HubCommands & {
        readonly retry: () => void
        readonly setValuesText: (value: string) => void
        readonly setPrice: (value: string) => void
        readonly openDialog: (dialog: HubDialog | null) => void
    }
}

type Props = AgentTemplatesHubBaseProps

/** The rows of one newer version offered to an agent: its heading row with the one primary command, then a row per changed part. */
const offerRowsOf = (props: Props, offer: OfferView): ReadonlyArray<ListRowData> => {
    const view = props.props
    return [
        {
            id: `${offer.installationId}-head`,
            title: offer.title,
            description: offer.changelog,
            action: {
                label: view.acceptSafeLabel,
                intent: "commit",
                isPending: view.isPending,
                press: () => props.on.accept(offer.installationId, [...offer.safeUnitIds]),
            },
        },
        ...offer.units.map((unit): ListRowData => ({
            id: unit.id,
            title: unit.line,
            action: {
                label: view.acceptUnitLabel,
                intent: "neutral",
                isPending: view.isPending,
                press: () => props.on.accept(offer.installationId, [unit.id]),
            },
        })),
    ]
}

/** The rows of the caller's templates: a row per saved version, "import here" as its command and "offer on the marketplace" in its menu. */
const templateRowsOf = (props: Props, data: AgentTemplatesHubData): ReadonlyArray<ListRowData> => {
    const view = props.props
    return data.templates.flatMap((template) =>
        template.versions.map((version): ListRowData => ({
            id: `${template.key}-${String(version.version)}`,
            title: template.name,
            description: version.line,
            leading: { avatar: { name: template.name, kind: "agent" } },
            action: {
                label: view.importLabel,
                intent: "neutral",
                press: () => props.on.openDialog({ kind: "import", key: template.key, version: version.version }),
            },
            menu: {
                label: view.moreLabel,
                entries: [
                    {
                        id: "submit",
                        label: view.submitLabel,
                        onAction: () =>
                            props.on.openDialog({ kind: "submit", key: template.key, version: version.version }),
                    },
                ],
            },
        })),
    )
}

/** The dialog of the command that needs a value: the values of an import, or the price of a listing. */
interface CommandDialogProps extends Props {
    readonly dialog: HubDialog
}

const CommandDialog = (props: CommandDialogProps): ReactElement => {
    const view = props.props
    const isImport = props.dialog.kind === "import"
    const run = () => {
        if (isImport) props.on.importVersion(props.dialog.key, props.dialog.version)
        else props.on.submitVersion(props.dialog.key, props.dialog.version)
        props.on.openDialog(null)
    }
    return (
        <Dialog
            isOpen
            onOpenChange={() => props.on.openDialog(null)}
            isDismissable={!view.isPending}
            size="sm"
            title={isImport ? view.importLabel : view.submitLabel}
            closeLabel={view.cancelLabel}
            footer={
                <>
                    <Button intent="neutral" isDisabled={view.isPending} onPress={() => props.on.openDialog(null)}>
                        {view.cancelLabel}
                    </Button>
                    <Button intent="commit" isPending={view.isPending} onPress={run}>
                        {isImport ? view.importLabel : view.submitLabel}
                    </Button>
                </>
            }
        >
            <Stack gap="row">
                {isImport ? (
                    <Textarea
                        id="template-values"
                        name="values"
                        label={view.valuesLabel}
                        description={view.valuesHint}
                        rows={3}
                        value={view.valuesText}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setValuesText}
                    />
                ) : (
                    <Input
                        id="template-price"
                        name="price"
                        label={view.priceLabel}
                        value={view.price}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setPrice}
                    />
                )}
            </Stack>
        </Dialog>
    )
}

/**
 * Draws the templates of the caller: first the newer versions offered to the agents installed from a template (they need the owner), each
 * with its changed parts, then the caller's own templates, a row per version with its command; a command that needs a value asks for it in a dialog.
 */
export const AgentTemplatesHubBase = (props: AgentTemplatesHubBaseProps): ReactElement => {
    const view = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            onRetry={props.on.retry}
            frame={framelessNotice}
            render={(data, isLoading) => (
                <Stack gap="region">
                    {view.notice === undefined ? null : <Alert tone="cautionary" title={view.notice} />}
                    <SurfaceCard
                        kind="list"
                        label={view.offersTitle}
                        headingLevel={2}
                        isLoading={isLoading}
                        count={data.offers.length}
                        items={data.offers.flatMap((offer) => offerRowsOf(props, offer))}
                        empty={<EmptyNotice message={view.noOffers} iconSource={nivoIconSource("overview", "leading")} />}
                    />
                    <SurfaceCard
                        kind="list"
                        label={view.mineTitle}
                        headingLevel={2}
                        isLoading={isLoading}
                        count={data.templates.length}
                        items={templateRowsOf(props, data)}
                        empty={<EmptyNotice message={view.slotLabels.empty} iconSource={nivoIconSource("overview", "leading")} />}
                    />
                    {view.dialog === null ? null : <CommandDialog {...props} dialog={view.dialog} />}
                </Stack>
            )}
        />
    )
}
