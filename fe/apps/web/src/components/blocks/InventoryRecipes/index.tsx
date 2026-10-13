"use client"

import { useInventoryBoard } from "@/hooks/inventoryBoard"
import { useTranslations } from "next-intl"
import { openById, useInventoryFormat, useRecipeDrawer } from "@/hooks/inventory"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"
import { InventoryRecipesBase } from "./component"

/** The recipes tab: the drawer lives in its hook, the drawing in the pure half. */
export const InventoryRecipes = () => {
    const board = useInventoryBoard()
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const commands = useInventoryCatalogCommands()
    const drawer = useRecipeDrawer(board.items, commands)
    return (
        <InventoryRecipesBase
            props={{
                addLabel: board.canManage ? t("recipeAdd") : null,
                addDisabled: board.items.length === 0,
                editLabel: board.canManage ? t("edit") : null,
                listLabel: t("recipeList"),
                emptyTitle: t("recipeEmptyTitle"),
                emptyBody: t("recipeEmptyBody"),
                rows: board.recipes.map((recipe) => ({
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
                edit: openById(board.recipes, drawer.open),
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
