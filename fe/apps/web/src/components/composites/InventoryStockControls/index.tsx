import type { InventoryStockData, InventoryStockActions } from "@/modules/types"
import { Button, Cluster, SearchField } from "@starci/grammar/common"
import { TOOLBAR_FIELD_CLASS_NAME } from "./classNames"

/** The original stock search, add and draft-low-stock controls, with resolved copy and actions. */
type InventoryStockControlsProps = Pick<
    InventoryStockData,
    "searchLabel" | "searchPlaceholder" | "clearLabel" | "addLabel" | "draftLabel" | "query" | "isPending"
> & {
    readonly isLoading: boolean
    readonly onQuery: InventoryStockActions["onQuery"]
    readonly onAdd: InventoryStockActions["onAdd"]
    readonly onDraft: InventoryStockActions["onDraft"]
}

/** Draws the unchanged stock toolbar order and field layout. */
export const InventoryStockControls = (props: InventoryStockControlsProps) => (
    <Cluster gap="inline" justify="between">
        <div className={TOOLBAR_FIELD_CLASS_NAME}>
            <SearchField
                isLoading={props.isLoading}
                label={props.searchLabel}
                isLabelHidden
                placeholder={props.searchPlaceholder}
                clearLabel={props.clearLabel}
                value={props.query}
                onValueChange={props.onQuery}
                onClear={() => props.onQuery("")}
            />
        </div>
        <Cluster gap="inline">
            {props.addLabel === null ? null : (
                <Button isLoading={props.isLoading} intent="commit" size="sm" onPress={props.onAdd}>
                    {props.addLabel}
                </Button>
            )}
            {props.draftLabel === null ? null : (
                <Button
                    isLoading={props.isLoading}
                    intent="alternative"
                    size="sm"
                    isPending={props.isPending}
                    onPress={props.onDraft}
                >
                    {props.draftLabel}
                </Button>
            )}
        </Cluster>
    </Cluster>
)
