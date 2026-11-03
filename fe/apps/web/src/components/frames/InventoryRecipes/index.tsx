import type { InventoryRecipesData, InventoryRecipesActions } from "@/modules/types"

/** Resolved recipes fields and atomic commands; the module Base owns read status. */
type InventoryRecipesProps = InventoryRecipesData & {
    readonly isLoading: boolean
    readonly onAdd: InventoryRecipesActions["onAdd"]
    readonly onEdit: InventoryRecipesActions["onEdit"]
    readonly onRecipeName: InventoryRecipesActions["onRecipeName"]
    readonly onRecipeAliases: InventoryRecipesActions["onRecipeAliases"]
    readonly onRecipeItem: InventoryRecipesActions["onRecipeItem"]
    readonly onRecipeQty: InventoryRecipesActions["onRecipeQty"]
    readonly onRecipeRemoveLine: InventoryRecipesActions["onRecipeRemoveLine"]
    readonly onRecipeAddLine: InventoryRecipesActions["onRecipeAddLine"]
    readonly onRecipeSave: InventoryRecipesActions["onRecipeSave"]
    readonly onRecipeRemove: InventoryRecipesActions["onRecipeRemove"]
    readonly onRecipeClose: InventoryRecipesActions["onRecipeClose"]
}
import { InventoryRecipeDrawer } from "@/components/composites/InventoryRecipeDrawer"

import { Button, Stack } from "@starci/grammar/common"
import { InventoryRowList } from "@/components/composites/InventoryRowList"

/** The recipes tab: what one product on an order takes out of stock. */
export const InventoryRecipes = (props: InventoryRecipesProps) => {
    const on = {
        add: props.onAdd,
        edit: props.onEdit,
        recipeName: props.onRecipeName,
        recipeAliases: props.onRecipeAliases,
        recipeItem: props.onRecipeItem,
        recipeQty: props.onRecipeQty,
        recipeRemoveLine: props.onRecipeRemoveLine,
        recipeAddLine: props.onRecipeAddLine,
        recipeSave: props.onRecipeSave,
        recipeRemove: props.onRecipeRemove,
        recipeClose: props.onRecipeClose,
    }
    return (
        <Stack gap="row">
            {props.addLabel === null ? null : (
                <div>
                    <Button
                        isLoading={props.isLoading}
                        intent="commit"
                        size="sm"
                        isDisabled={props.addDisabled}
                        onPress={on.add}
                    >
                        {props.addLabel}
                    </Button>
                </div>
            )}
            <InventoryRowList
                isLoading={props.isLoading}
                label={props.listLabel}
                emptyTitle={props.emptyTitle}
                emptyBody={props.emptyBody}
                items={props.rows.map((row) => ({
                    id: row.id,
                    title: row.title,
                    description: row.detail,
                    ...(props.editLabel === null
                        ? {}
                        : { action: { label: props.editLabel, press: () => on.edit(row.id) } }),
                }))}
            />
            {props.drawer === null ? null : (
                <InventoryRecipeDrawer
                    props={props.drawer}
                    on={{
                        name: on.recipeName,
                        aliases: on.recipeAliases,
                        item: on.recipeItem,
                        qty: on.recipeQty,
                        removeLine: on.recipeRemoveLine,
                        addLine: on.recipeAddLine,
                        save: on.recipeSave,
                        remove: on.recipeRemove,
                        close: on.recipeClose,
                    }}
                />
            )}
        </Stack>
    )
}
