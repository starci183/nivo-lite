"use client"

import type { InventoryPanelScope } from "./inventory.shared"
import type { ItemView, RecipeView } from "@/modules/types"
import { changeAt } from "./inventory.shared"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import { sayAll } from "@/modules/inventory"
import { useDrawer } from "./useDrawer"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** One typed ingredient with the key that keeps its inputs stable. */
interface TypedLine {
    readonly key: string
    readonly itemId: string
    readonly qty: string
}

/** The recipe drawer while it is open: the recipe being changed (null adds one) and what was typed. */
interface RecipeDrawerState {
    readonly recipe: RecipeView | null
    readonly name: string
    readonly aliases: string
    readonly lines: ReadonlyArray<TypedLine>
    readonly serial: number
}

const startRecipeState = (recipe: RecipeView | null): RecipeDrawerState => {
    const lines =
        recipe === null
            ? [{ key: "line-0", itemId: "", qty: "" }]
            : recipe.lines.map((line, index) => ({ key: `line-${index}`, itemId: line.itemId, qty: String(line.qty) }))
    return { recipe, name: recipe?.name ?? "", aliases: recipe?.aliases.join(", ") ?? "", lines, serial: lines.length }
}

/** The view `useRecipeDrawer` returns. */
export interface RecipeDrawerView {
    open: (target: RecipeView | null) => void
    props: {
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
    on: {
        name: (name: string) => void
        aliases: (aliases: string) => void
        item: (index: number, itemId: string) => void
        qty: (index: number, qty: string) => void
        removeLine: (index: number) => void
        addLine: () => void
        save: () => void
        remove: () => void
        close: () => void
    }
}

/** Opens, fills and saves the recipe form; `props` is null while the drawer is closed. */
export const useRecipeDrawer = (
    items: ReadonlyArray<ItemView>,
    commands: InventoryCommandSet<"saveRecipe" | "deleteRecipe">,
    lifetime?: InventoryPanelScope,
): RecipeDrawerView => {
    const { isActive = true, scope = "" } = lifetime ?? {}

    const say = useSay()
    const run = useInventoryRun(isActive, scope)
    const drawer = useDrawer<RecipeDrawerState>(isActive, scope)
    const { state, change } = drawer
    const unitOf = (id: string): string => items.find((item) => item.id === id)?.unit ?? ""
    return {
        open: (target: RecipeView | null) => drawer.open(startRecipeState(target)),
        props:
            state === null
                ? null
                : {
                      copy: recipeDrawerCopy(say, state.recipe),
                      editing: state.recipe === null ? null : state.recipe.name,
                      name: state.name,
                      aliases: state.aliases,
                      lines: state.lines.map((line, index) => ({
                          ...line,
                          ingredientLabel: say("recipeIngredient", { n: index + 1 }),
                          quantityLabel: say("recipeQty", {
                              unit: line.itemId === "" ? "" : ` (${unitOf(line.itemId)})`,
                          }),
                          unit: line.itemId === "" ? "" : ` (${unitOf(line.itemId)})`,
                      })),
                      items: items
                          .filter((item) => item.active)
                          .map((item) => ({ id: item.id, label: `${item.name} (${item.unit})` })),
                      isPending: run.isPending,
                      error: run.error,
                  },
        on: {
            name: (name: string) => change((current) => ({ ...current, name })),
            aliases: (aliases: string) => change((current) => ({ ...current, aliases })),
            item: (index: number, itemId: string) =>
                change((current) => ({ ...current, lines: changeAt(current.lines, index, { itemId }) })),
            qty: (index: number, qty: string) =>
                change((current) => ({ ...current, lines: changeAt(current.lines, index, { qty }) })),
            removeLine: (index: number) =>
                change((current) => ({ ...current, lines: current.lines.filter((_, at) => at !== index) })),
            addLine: () =>
                change((current) => ({
                    ...current,
                    lines: [...current.lines, { key: `line-${current.serial}`, itemId: "", qty: "" }],
                    serial: current.serial + 1,
                })),
            save: () => {
                if (state === null) return
                const target = state.recipe
                run.exec(
                    () =>
                        commands.saveRecipe({
                            ...(target === null ? {} : { id: target.id }),
                            name: state.name,
                            aliases: state.aliases,
                            lines: state.lines.map((line) => ({ itemId: line.itemId, qty: line.qty })),
                        }),
                    drawer.finish,
                )
            },
            remove: () => {
                const target = state?.recipe ?? null
                if (target !== null) run.exec(() => commands.deleteRecipe(target.id), drawer.finish)
            },
            close: drawer.close,
        },
    }
}

/** The sentences of the catalog the drawer reads under their own names. */
const RECIPE_DRAWER_KEYS = [
    "recipeAddTitle",
    "recipeDrawerHint",
    "close",
    "recipeName",
    "recipeNameHint",
    "recipeAliases",
    "recipeAliasesHint",
    "recipeIngredients",
    "recipeIngredientHint",
    "recipeRemoveLine",
    "recipeAddLine",
    "save",
    "recipeDelete",
] as const

/** Resolves the exact recipe drawer copy in its domain owner. */
const recipeDrawerCopy = (say: ReturnType<typeof useSay>, owner: RecipeView | null) => ({
    ...sayAll(say, RECIPE_DRAWER_KEYS),
    recipeEditTitle: say("recipeEditTitle", { name: owner?.name ?? "" }),
})
