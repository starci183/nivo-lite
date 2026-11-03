import { Alert, Button, EmptyNotice, Input, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
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

/** Copy, values and state the connected hub supplies. */
export interface AgentTemplatesHubBaseProps {
    readonly props: {
        readonly slot: DataSlot<AgentTemplatesHubData>
        readonly placeholder: AgentTemplatesHubData
        readonly slotLabels: SlotLabels
        readonly mineTitle: string
        readonly offersTitle: string
        readonly valuesLabel: string
        readonly valuesHint: string
        readonly valuesText: string
        readonly priceLabel: string
        readonly price: string
        readonly importLabel: string
        readonly submitLabel: string
        readonly acceptSafeLabel: string
        readonly acceptUnitLabel: string
        readonly noOffers: string
        readonly notice: string | undefined
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly setValuesText: (value: string) => void
        readonly setPrice: (value: string) => void
        readonly importVersion: (key: string, version: number) => void
        readonly submitVersion: (key: string, version: number) => void
        readonly accept: (installationId: string, unitIds: Array<string>) => void
    }
}

/**
 * Draws the templates of the caller: each version with the commands to install it in this workspace (shadow mode) and to offer it on the
 * marketplace, then the newer versions offered to the agents installed from a template, branch by branch.
 */
export const AgentTemplatesHubBase = (props: AgentTemplatesHubBaseProps) => {
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
                                    <SurfaceCard
                                        key={template.key}
                                        label={`${template.name} (${template.key})`}
                                        headingLevel={3}
                                    >
                                        <div className={CARD_CLASS_NAME}>
                                            {template.versions.map((version) => (
                                                <div key={version.version} className={CARD_CLASS_NAME}>
                                                    <Text size="sm">{version.line}</Text>
                                                    <div className={ACTIONS_CLASS_NAME}>
                                                        <Button
                                                            intent="commit"
                                                            isPending={view.isPending}
                                                            isDisabled={isLoading}
                                                            onPress={() =>
                                                                props.on.importVersion(template.key, version.version)
                                                            }
                                                        >
                                                            {view.importLabel}
                                                        </Button>
                                                        <Button
                                                            intent="neutral"
                                                            isPending={view.isPending}
                                                            isDisabled={isLoading}
                                                            onPress={() =>
                                                                props.on.submitVersion(template.key, version.version)
                                                            }
                                                        >
                                                            {view.submitLabel}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SurfaceCard>
                                ))}
                                <SurfaceCard label={view.offersTitle} headingLevel={2}>
                                    <div className={CARD_CLASS_NAME}>
                                        {data.offers.length === 0 ? <EmptyNotice message={view.noOffers} /> : null}
                                        {data.offers.map((offer) => (
                                            <div key={offer.installationId} className={CARD_CLASS_NAME}>
                                                <Text size="sm">{offer.title}</Text>
                                                <Text size="xs" tone="muted">
                                                    {offer.changelog}
                                                </Text>
                                                {offer.units.map((unit) => (
                                                    <div key={unit.id} className={ACTIONS_CLASS_NAME}>
                                                        <Text size="sm">{unit.line}</Text>
                                                        <Button
                                                            intent="neutral"
                                                            isPending={view.isPending}
                                                            onPress={() =>
                                                                props.on.accept(offer.installationId, [unit.id])
                                                            }
                                                        >
                                                            {view.acceptUnitLabel}
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button
                                                    intent="commit"
                                                    isPending={view.isPending}
                                                    isDisabled={offer.safeUnitIds.length === 0}
                                                    onPress={() =>
                                                        props.on.accept(offer.installationId, [...offer.safeUnitIds])
                                                    }
                                                >
                                                    {view.acceptSafeLabel}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </SurfaceCard>
                            </>
                        )}
                    />
                </div>
            </SurfaceCard>
        </div>
    )
}
