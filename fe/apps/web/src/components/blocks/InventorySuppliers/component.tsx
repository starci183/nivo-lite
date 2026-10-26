import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import type { SupplierFormField } from "@/hooks/inventory"
import { InventorySupplierDrawer } from "@/components/composites/InventorySupplierDrawer"
import type { InventorySupplierDrawerProps } from "@/components/composites/InventorySupplierDrawer"
import { Badge, Button, EmptyNotice, Input, ListRow, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One supplier row, every word already resolved. */
export interface SupplierRowView {
    readonly id: string
    readonly name: string
    readonly channelLabel: string
    readonly detail: string
    readonly itemsText: string
}

/** The words and data of the suppliers tab. */
export interface InventorySuppliersBaseProps {
    readonly props: {
        readonly addLabel: string | null
        readonly editLabel: string | null
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<SupplierRowView>
        readonly locationsTitle: string
        readonly locationsText: string
        /** Whether the add-a-location field shows (owner and manager). */
        readonly canAddLocation: boolean
        readonly locationLabel: string
        readonly locationAddLabel: string
        readonly locationName: string
        readonly isPending: boolean
        readonly error: string | null
        /** The drawer while it is open. */
        readonly drawer: InventorySupplierDrawerProps["props"] | null
    }
    readonly on: {
        readonly add: () => void
        readonly edit: (id: string) => void
        readonly locationName: (value: string) => void
        readonly addLocation: () => void
        readonly supplierField: (name: SupplierFormField, value: string) => void
        readonly supplierSave: () => void
        readonly supplierClose: () => void
    }
}

/** The suppliers tab: who the orders go to, and the places the stock lives in. */
export const InventorySuppliersBase = (props: InventorySuppliersBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={STACK_CLASS_NAME}>
            {p.addLabel === null ? null : (
                <div>
                    <Button intent="commit" size="sm" onPress={on.add}>
                        {p.addLabel}
                    </Button>
                </div>
            )}
            <SurfaceListCard
                ariaLabel={p.listLabel}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.name}
                        description={row.detail}
                        badges={<Badge tone="neutral">{row.channelLabel}</Badge>}
                        actions={
                            p.editLabel === null ? undefined : (
                                <Button intent="neutral" size="sm" onPress={() => on.edit(row.id)}>
                                    {p.editLabel}
                                </Button>
                            )
                        }
                    >
                        <Text size="xs" tone="muted">
                            {row.itemsText}
                        </Text>
                    </ListRow>
                ))}
            </SurfaceListCard>
            <SurfaceCard label={p.locationsTitle} headingLevel={2}>
                <div className={FORM_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {p.locationsText}
                    </Text>
                    {p.canAddLocation ? (
                        <div className={ACTIONS_CLASS_NAME}>
                            <Input
                                id="loc-name"
                                name="location"
                                label={p.locationLabel}
                                value={p.locationName}
                                onValueChange={on.locationName}
                            />
                            <Button
                                intent="neutral"
                                isPending={p.isPending}
                                isDisabled={p.locationName.trim() === ""}
                                onPress={on.addLocation}
                            >
                                {p.locationAddLabel}
                            </Button>
                        </div>
                    ) : null}
                    <InventoryNotices error={p.error} />
                </div>
            </SurfaceCard>
            {p.drawer === null ? null : (
                <InventorySupplierDrawer
                    props={p.drawer}
                    on={{ field: on.supplierField, save: on.supplierSave, close: on.supplierClose }}
                />
            )}
        </div>
    )
}
