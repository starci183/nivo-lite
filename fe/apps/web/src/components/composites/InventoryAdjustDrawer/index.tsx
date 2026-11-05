import type { InventoryAdjustmentEditorData } from "@/modules/types"
import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, ChoiceChips, Drawer, Input, Text, Stack } from "@starci/grammar/common"

/** The words and state of the quantity drawer. */
interface InventoryAdjustDrawerProps {
    readonly props: InventoryAdjustmentEditorData
    readonly on: {
        readonly mode: (value: string) => void
        readonly from: (value: string) => void
        readonly to: (value: string) => void
        readonly value: (value: string) => void
        readonly reason: (value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** The form that sets, changes or moves the quantity of one item. */
export const InventoryAdjustDrawer = (props: InventoryAdjustDrawerProps) => {
    const { props: p, on } = props
    const copy = p.copy
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={copy.adjustTitle}
            description={p.summary}
            closeLabel={copy.close}
            placement="right"
        >
            <Stack gap="row">
                <ChoiceChips
                    label={copy.adjustMode}
                    empty={copy.adjustMode}
                    options={p.modes}
                    value={p.mode}
                    onValueChange={on.mode}
                />
                {p.showPlaces ? (
                    <InventorySelect
                        label={p.isMove ? copy.adjustFrom : copy.adjustAt}
                        value={p.from}
                        options={p.places}
                        onChange={(value) => on.from(value)}
                    />
                ) : null}
                {p.isMove ? (
                    <InventorySelect
                        label={copy.adjustTo}
                        placeholder={copy.adjustToHint}
                        value={p.to}
                        options={p.targets}
                        onChange={(value) => on.to(value)}
                    />
                ) : null}
                <InventoryField
                    id="adj-value"
                    name="value"
                    label={copy.valueLabel}
                    value={p.value}
                    onChange={on.value}
                />
                <Input
                    id="adj-reason"
                    name="reason"
                    label={p.isMove ? copy.adjustNote : copy.adjustReason}
                    {...(p.isMove ? {} : { hint: copy.adjustReasonHint })}
                    value={p.reason}
                    onValueChange={on.reason}
                />
                {p.preview === null ? null : (
                    <Text size="sm" tone="muted">
                        {p.preview}
                    </Text>
                )}
                <InventoryNotices error={p.error} notice={p.notice} />
                <div>
                    <Button intent="commit" isPending={p.isPending} isDisabled={!p.canSubmit} onPress={on.submit}>
                        {p.submitLabel}
                    </Button>
                </div>
            </Stack>
        </Drawer>
    )
}
