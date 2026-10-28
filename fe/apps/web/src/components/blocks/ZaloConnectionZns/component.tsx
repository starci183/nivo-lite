import { Alert, Button, FormGrid, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZnsRenewalForm } from "@/modules/types"
import { ZALO_ZNS_CLASS_NAMES as classNames } from "./classNames"

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

/** Copy, slot and commands of the ZNS renewal template card. */
export interface ZaloConnectionZnsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
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
    }
}

/** Draws the ZNS renewal template card: the approved template id and the parameter name of each renewal field. */
export const ZaloConnectionZnsBase = (props: ZaloConnectionZnsBaseProps) => {
    const view = props.props
    const isLocked = !view.canEdit || view.isPending
    return (
        <SurfaceCard label={view.title} headingLevel={2}>
            <SlotView slot={view.slot} placeholder={ZNS_PLACEHOLDER} labels={view.slotLabels} onRetry={props.on.retry}>
                {(_stored, isSkeleton) => (
                    <div className={classNames.stack}>
                        <Text size="sm" tone="muted">
                            {view.hint}
                        </Text>
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
                        {view.note === "" ? null : <Alert tone="negative" title={view.note} />}
                        <div>
                            <Button
                                intent="commit"
                                isPending={view.isPending}
                                isDisabled={isLocked || isSkeleton}
                                onPress={props.on.save}
                            >
                                {view.saveLabel}
                            </Button>
                        </div>
                    </div>
                )}
            </SlotView>
        </SurfaceCard>
    )
}
