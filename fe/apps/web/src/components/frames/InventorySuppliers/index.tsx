import type { InventorySuppliersData, InventorySuppliersActions } from "@/modules/types"

/** Resolved suppliers fields and atomic commands; the module Base owns read status. */
type InventorySuppliersProps = InventorySuppliersData & {
    readonly isLoading: boolean
    readonly onAdd: InventorySuppliersActions["onAdd"]
    readonly onEdit: InventorySuppliersActions["onEdit"]
    readonly onLocationName: InventorySuppliersActions["onLocationName"]
    readonly onAddLocation: InventorySuppliersActions["onAddLocation"]
    readonly onSupplierField: InventorySuppliersActions["onSupplierField"]
    readonly onSupplierSave: InventorySuppliersActions["onSupplierSave"]
    readonly onSupplierClose: InventorySuppliersActions["onSupplierClose"]
}
import { InventoryNotices } from "@/components/leaves/InventoryNotices"

import { InventorySupplierDrawer } from "@/components/composites/InventorySupplierDrawer"

import { Button, Cluster, EmptyNotice, Input, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** The suppliers tab: who the orders go to, and the places the stock lives in. */
export const InventorySuppliers = (props: InventorySuppliersProps) => {
    const on = {
        add: props.onAdd,
        edit: props.onEdit,
        locationName: props.onLocationName,
        addLocation: props.onAddLocation,
        supplierField: props.onSupplierField,
        supplierSave: props.onSupplierSave,
        supplierClose: props.onSupplierClose,
    }
    return (
        <Stack gap="row">
            {props.addLabel === null ? null : (
                <div>
                    <Button isLoading={props.isLoading} intent="commit" size="sm" onPress={on.add}>
                        {props.addLabel}
                    </Button>
                </div>
            )}
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                label={props.listLabel}
                empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
                items={props.rows.map((row) => ({
                    id: row.id,
                    title: row.name,
                    description: row.detail,
                    badges: [{ label: row.channelLabel, tone: "neutral" }],
                    ...(props.editLabel === null
                        ? {}
                        : { action: { label: props.editLabel, intent: "neutral", press: () => on.edit(row.id) } }),
                    detail: (
                        <Text size="xs" tone="muted">
                            {row.itemsText}
                        </Text>
                    ),
                }))}
            />
            <SurfaceCard isLoading={props.isLoading} label={props.locationsTitle} headingLevel={2}>
                <Stack gap="row">
                    <Text size="sm" tone="muted">
                        {props.locationsText}
                    </Text>
                    {props.canAddLocation ? (
                        <Cluster gap="inline" align="end">
                            <Input
                                isLoading={props.isLoading}
                                id="loc-name"
                                name="location"
                                label={props.locationLabel}
                                value={props.locationName}
                                onValueChange={on.locationName}
                            />
                            <Button
                                isLoading={props.isLoading}
                                intent="neutral"
                                isPending={props.isPending}
                                isDisabled={props.locationName.trim() === ""}
                                onPress={on.addLocation}
                            >
                                {props.locationAddLabel}
                            </Button>
                        </Cluster>
                    ) : null}
                    <InventoryNotices error={props.error} />
                </Stack>
            </SurfaceCard>
            {props.drawer === null ? null : (
                <InventorySupplierDrawer
                    props={props.drawer}
                    on={{ field: on.supplierField, save: on.supplierSave, close: on.supplierClose }}
                />
            )}
        </Stack>
    )
}
