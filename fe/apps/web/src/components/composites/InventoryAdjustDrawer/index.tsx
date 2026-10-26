import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Drawer, Input, SegmentedControl, Text } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** The words and state of the quantity drawer. */
export interface InventoryAdjustDrawerProps {
    readonly props: {
        readonly say: InventorySay
        readonly itemName: string
        readonly unit: string
        readonly summary: string
        readonly modes: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly mode: string
        readonly isMove: boolean
        readonly showPlaces: boolean
        readonly places: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly targets: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly from: string
        readonly to: string
        readonly value: string
        readonly reason: string
        readonly preview: string | null
        readonly submitLabel: string
        readonly canSubmit: boolean
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
    }
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
    const say = p.say
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={say("adjustTitle", { name: p.itemName })}
            description={p.summary}
            closeLabel={say("close")}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                <SegmentedControl label={say("adjustMode")} options={p.modes} value={p.mode} onValueChange={on.mode} />
                {p.showPlaces ? (
                    <InventorySelect
                        label={p.isMove ? say("adjustFrom") : say("adjustAt")}
                        value={p.from}
                        options={p.places}
                        onChange={(value) => on.from(value)}
                    />
                ) : null}
                {p.isMove ? (
                    <InventorySelect
                        label={say("adjustTo")}
                        placeholder={say("adjustToHint")}
                        value={p.to}
                        options={p.targets}
                        onChange={(value) => on.to(value)}
                    />
                ) : null}
                <InventoryField
                    id="adj-value"
                    name="value"
                    label={say(`adjustValue_${p.mode}`, { unit: p.unit })}
                    value={p.value}
                    onChange={on.value}
                />
                <Input
                    id="adj-reason"
                    name="reason"
                    label={p.isMove ? say("adjustNote") : say("adjustReason")}
                    {...(p.isMove ? {} : { hint: say("adjustReasonHint") })}
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
            </div>
        </Drawer>
    )
}
