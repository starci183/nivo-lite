"use client"

import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { openById, useInventoryFormat, useRecipeDrawer } from "@/hooks/inventory"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"

/** The view `useInventoryRecipesView` returns. */
export interface InventoryRecipesView {
    readonly props: {
        readonly addLabel: string | null
        readonly addDisabled: boolean
        readonly editLabel: string | null
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: {
            id: string
            title: string
            detail: string
        }[]
        readonly drawer: {
            copy: {
                recipeEditTitle: string
                close: string
                save: string
                recipeAddTitle: string
                recipeDrawerHint: string
                recipeName: string
                recipeNameHint: string
                recipeAliases: string
                recipeAliasesHint: string
                recipeIngredients: string
                recipeIngredientHint: string
                recipeRemoveLine: string
                recipeAddLine: string
                recipeDelete: string
            }
            editing: string | null
            name: string
            aliases: string
            lines: {
                ingredientLabel: string
                quantityLabel: string
                unit: string
                key: string
                itemId: string
                qty: string
            }[]
            items: {
                id: string
                label: string
            }[]
            isPending: boolean
            error: string | null
        } | null
    }
    readonly on: {
        readonly onAdd: () => void
        readonly onEdit: (id: string) => void
        readonly onRecipeName: (name: string) => void
        readonly onRecipeAliases: (aliases: string) => void
        readonly onRecipeItem: (index: number, itemId: string) => void
        readonly onRecipeQty: (index: number, qty: string) => void
        readonly onRecipeRemoveLine: (index: number) => void
        readonly onRecipeAddLine: () => void
        readonly onRecipeSave: () => void
        readonly onRecipeRemove: () => void
        readonly onRecipeClose: () => void
    }
}

/** The recipes tab: the drawer lives in its hook, the drawing in the pure half. */
export const useInventoryRecipesView = (input: InventoryPanelInput): InventoryRecipesView => {
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
