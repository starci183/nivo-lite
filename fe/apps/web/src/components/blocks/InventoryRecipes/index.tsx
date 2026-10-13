"use client"

import { useTranslations } from "next-intl"
import { openById, useInventoryFormat, useRecipeDrawer } from "@/hooks/inventory"
import type { InventoryWorkbenchData } from "@/modules/types"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"
import { InventoryRecipesBase } from "./component"

/** The workbench data and the workspace. */
interface InventoryRecipesProps {
    readonly data: InventoryWorkbenchData
}

/** The recipes tab: the drawer lives in its hook, the drawing in the pure half. */
export const InventoryRecipes = (props: InventoryRecipesProps) => {
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const { data } = props
    const commands = useInventoryCatalogCommands()
    const drawer = useRecipeDrawer(data.items, commands)
    return (
        <InventoryRecipesBase
            props={{
                addLabel: data.canManage ? t("recipeAdd") : null,
                addDisabled: data.items.length === 0,
                editLabel: data.canManage ? t("edit") : null,
                listLabel: t("recipeList"),
                emptyTitle: t("recipeEmptyTitle"),
                emptyBody: t("recipeEmptyBody"),
                rows: data.recipes.map((recipe) => ({
                    id: recipe.id,
                    title: t("recipeRowTitle", { name: recipe.name }),
                    detail: recipe.lines
                        .map((line) =>
                            t("recipeRowLine", { qty: format.qty(line.qty), unit: line.unit, name: line.name }),
                        )
                        .join(" + "),
                })),
                drawer: drawer.props,
            }}
            on={{
                add: () => drawer.open(null),
                edit: openById(data.recipes, drawer.open),
                recipeName: drawer.on.name,
                recipeAliases: drawer.on.aliases,
                recipeItem: drawer.on.item,
                recipeQty: drawer.on.qty,
                recipeRemoveLine: drawer.on.removeLine,
                recipeAddLine: drawer.on.addLine,
                recipeSave: drawer.on.save,
                recipeRemove: drawer.on.remove,
                recipeClose: drawer.on.close,
            }}
        />
    )
}
