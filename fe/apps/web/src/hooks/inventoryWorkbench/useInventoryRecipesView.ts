"use client"

import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { openById, useInventoryFormat, useRecipeDrawer } from "@/hooks/inventory"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"

/** The recipes tab: the drawer lives in its hook, the drawing in the pure half. */
export const useInventoryRecipesView = (input: InventoryPanelInput) => {
    const board = input.board
    const lifetime = { isActive: input.isActive, scope: input.scope }
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const commands = useInventoryCatalogCommands()
    const drawer = useRecipeDrawer(board.items, commands, lifetime)
    return {
        props: {
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
                    .map((line) => t("recipeRowLine", { qty: format.qty(line.qty), unit: line.unit, name: line.name }))
                    .join(" + "),
            })),
            drawer: drawer.props,
        },
        on: {
            onAdd: () => drawer.open(null),
            onEdit: openById(board.recipes, drawer.open),
            onRecipeName: drawer.on.name,
            onRecipeAliases: drawer.on.aliases,
            onRecipeItem: drawer.on.item,
            onRecipeQty: drawer.on.qty,
            onRecipeRemoveLine: drawer.on.removeLine,
            onRecipeAddLine: drawer.on.addLine,
            onRecipeSave: drawer.on.save,
            onRecipeRemove: drawer.on.remove,
            onRecipeClose: drawer.on.close,
        },
    } as const
}
