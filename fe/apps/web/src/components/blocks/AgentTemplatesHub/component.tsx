import { Alert, Button, EmptyNotice, Input, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { ReactElement } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME, BLOCK_CLASS_NAME, CARD_CLASS_NAME } from "./classNames"

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
}

/** The commands of the hub. */
interface HubCommands {
    readonly importVersion: (key: string, version: number) => void
    readonly submitVersion: (key: string, version: number) => void
    readonly accept: (installationId: string, unitIds: Array<string>) => void
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
    }
    readonly on: HubCommands & {
        readonly retry: () => void
        readonly setValuesText: (value: string) => void
        readonly setPrice: (value: string) => void
    }
}

/** What the rows of one template draw. */
interface TemplateRowsProps {
    readonly template: TemplateView
    readonly copy: HubCopy
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly on: HubCommands
}

/** The versions of one template, each with the commands to install it here and to offer it. */
const TemplateRows = (props: TemplateRowsProps): ReactElement => (
    <div className={CARD_CLASS_NAME}>
        <Text size="sm">{`${props.template.name} (${props.template.key})`}</Text>
        {props.template.versions.map((version) => (
            <div key={version.version} className={CARD_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {version.line}
                </Text>
                <div className={ACTIONS_CLASS_NAME}>
                    <Button
                        intent="alternative"
                        isPending={props.isPending}
                        isDisabled={props.isLoading}
                        onPress={() => props.on.importVersion(props.template.key, version.version)}
                    >
                        {props.copy.importLabel}
                    </Button>
                    <Button
                        intent="neutral"
                        isPending={props.isPending}
                        isDisabled={props.isLoading}
                        onPress={() => props.on.submitVersion(props.template.key, version.version)}
                    >
                        {props.copy.submitLabel}
                    </Button>
                </div>
            </div>
        ))}
    </div>
)

/** What the rows of one offer draw. */
interface OfferRowsProps {
    readonly offer: OfferView
    readonly copy: HubCopy
    readonly isPending: boolean
    readonly on: HubCommands
}

/** One offer of a newer version, branch by branch. */
const OfferRows = (props: OfferRowsProps): ReactElement => (
    <div className={CARD_CLASS_NAME}>
        <Text size="sm">{props.offer.title}</Text>
        <Text size="xs" tone="muted">
            {props.offer.changelog}
        </Text>
        {props.offer.units.map((unit) => (
            <div key={unit.id} className={ACTIONS_CLASS_NAME}>
                <Text size="sm">{unit.line}</Text>
                <Button
                    intent="neutral"
                    isPending={props.isPending}
                    onPress={() => props.on.accept(props.offer.installationId, [unit.id])}
                >
                    {props.copy.acceptUnitLabel}
                </Button>
            </div>
        ))}
        <Button
            intent="alternative"
            isPending={props.isPending}
            isDisabled={props.offer.safeUnitIds.length === 0}
            onPress={() => props.on.accept(props.offer.installationId, [...props.offer.safeUnitIds])}
        >
            {props.copy.acceptSafeLabel}
        </Button>
    </div>
)

/**
 * Draws the templates of the caller: each version with the commands to install it in this workspace (shadow mode) and to offer it on the
 * marketplace, then the newer versions offered to the agents installed from a template, branch by branch.
 */
export const AgentTemplatesHubBase = (props: AgentTemplatesHubBaseProps): ReactElement => {
    const view = props.props
    return (
        <div className={BLOCK_CLASS_NAME}>
            <SurfaceCard label={view.mineTitle} headingLevel={2}>
                <div className={CARD_CLASS_NAME}>
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
                    <Input
                        id="template-price"
                        name="price"
                        label={view.priceLabel}
                        value={view.price}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setPrice}
                    />
                    {view.notice === undefined ? null : <Alert tone="cautionary" title={view.notice} />}
                    <SlotView
                        slot={view.slot}
                        placeholder={view.placeholder}
                        labels={view.slotLabels}
                        onRetry={props.on.retry}
                        render={(data, isLoading) => (
                            <>
                                {data.templates.map((template) => (
                                    <TemplateRows
                                        key={template.key}
                                        template={template}
                                        copy={view}
                                        isPending={view.isPending}
                                        isLoading={isLoading}
                                        on={props.on}
                                    />
                                ))}
                                <Text size="sm">{view.offersTitle}</Text>
                                {data.offers.length === 0 ? <EmptyNotice message={view.noOffers} /> : null}
                                {data.offers.map((offer) => (
                                    <OfferRows
                                        key={offer.installationId}
                                        offer={offer}
                                        copy={view}
                                        isPending={view.isPending}
                                        on={props.on}
                                    />
                                ))}
                            </>
                        )}
                    />
                </div>
            </SurfaceCard>
        </div>
    )
}
