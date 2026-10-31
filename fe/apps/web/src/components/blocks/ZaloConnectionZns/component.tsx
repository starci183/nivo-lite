import { Alert, Button, Disclosure, Fieldset, FormGrid, Input, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZnsRenewalForm } from "@/modules/types"

/** The fields of the form, in the order they are drawn. */
export const ZNS_FIELDS = [
    "templateId",
    "customerName",
    "plan",
    "endDate",
    "amount",
    "transferContent",
    "invoiceNumber",
] as const satisfies ReadonlyArray<keyof ZnsRenewalForm>

/** Fake data of the same shape: the skeleton reuses the ready tree. */
export const ZNS_PLACEHOLDER: ZnsRenewalForm = {
    templateId: "000000",
    customerName: "-",
    plan: "-",
    endDate: "-",
    amount: "-",
    transferContent: "-",
    invoiceNumber: "-",
}

/** Copy, slot and commands of the ZNS renewal template band. */
export interface ZaloConnectionZnsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        /** What the template is set to, beside the title: its id, or that the fallback is off. */
        readonly summary: string
        readonly isOpen: boolean
        readonly slot: DataSlot<ZnsRenewalForm>
        readonly slotLabels: SlotLabels
        readonly form: ZnsRenewalForm
        readonly labels: Readonly<Record<keyof ZnsRenewalForm, string>>
        readonly saveLabel: string
        readonly note: string
        readonly canEdit: boolean
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly change: (patch: Partial<ZnsRenewalForm>) => void
        readonly save: () => void
        readonly toggle: (isOpen: boolean) => void
    }
}

/**
 * Draws the ZNS renewal template as a closed band under the setup steps (LAYOUT-1: an option that rarely changes sits in one
 * disclosure, its summary saying what it is set to): the approved template id and the parameter name of each renewal field.
 */
export const ZaloConnectionZnsBase = (props: ZaloConnectionZnsBaseProps) => {
    const view = props.props
    const isLocked = !view.canEdit || view.isPending
    return (
        <PaneSection>
            <Disclosure
                headingLevel={2}
                title={view.title}
                summary={view.summary}
                isExpanded={view.isOpen}
                onExpandedChange={props.on.toggle}
            >
                <SlotView
                    slot={view.slot}
                    placeholder={ZNS_PLACEHOLDER}
                    labels={view.slotLabels}
                    onRetry={props.on.retry}
                >
                    {(_stored, isSkeleton) => (
                        <Fieldset
                            legend={view.title}
                            isLegendHidden
                            description={view.hint}
                            actions={
                                view.canEdit ? (
                                    <Button
                                        intent="neutral"
                                        isPending={view.isPending}
                                        isDisabled={isSkeleton}
                                        onPress={props.on.save}
                                    >
                                        {view.saveLabel}
                                    </Button>
                                ) : undefined
                            }
                        >
                            <FormGrid columns={2}>
                                {ZNS_FIELDS.map((field) => (
                                    <Input
                                        key={field}
                                        id={`zns-${field}`}
                                        name={field}
                                        label={view.labels[field]}
                                        isDisabled={isLocked}
                                        isSkeleton={isSkeleton}
                                        value={view.form[field]}
                                        onValueChange={(value) => props.on.change({ [field]: value })}
                                    />
                                ))}
                            </FormGrid>
                            {view.note === "" ? null : <Alert tone="negative" appearance="soft" title={view.note} />}
                        </Fieldset>
                    )}
                </SlotView>
            </Disclosure>
        </PaneSection>
    )
}
