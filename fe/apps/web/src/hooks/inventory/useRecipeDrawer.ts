import type { InventoryPanelScope } from "./inventory.shared"
;("use client")

import type { ItemView, RecipeView } from "@/modules/types"
import { changeAt } from "./inventory.shared"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
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

/** Opens, fills and saves the recipe form; `props` is null while the drawer is closed. */
export const useRecipeDrawer = (
    items: ReadonlyArray<ItemView>,
    commands: InventoryCommandSet<"saveRecipe" | "deleteRecipe">,
    lifetime?: InventoryPanelScope,
) => {
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
                    (_value, isCurrent) => (isCurrent() ? drawer.done() : undefined),
                )
            },
            remove: () => {
                const target = state?.recipe ?? null
                if (target !== null)
                    run.exec(
                        () => commands.deleteRecipe(target.id),
                        (_value, isCurrent) => (isCurrent() ? drawer.done() : undefined),
                    )
            },
            close: drawer.close,
        },
    }
}

/** Resolves the exact recipe drawer copy in its domain owner. */
const recipeDrawerCopy = (say: ReturnType<typeof useSay>, owner: RecipeView | null) =>
    ({
        recipeAddTitle: say("recipeAddTitle"),
        recipeEditTitle: say("recipeEditTitle", { name: owner?.name ?? "" }),
        recipeDrawerHint: say("recipeDrawerHint"),
        close: say("close"),
        recipeName: say("recipeName"),
        recipeNameHint: say("recipeNameHint"),
        recipeAliases: say("recipeAliases"),
        recipeAliasesHint: say("recipeAliasesHint"),
        recipeIngredients: say("recipeIngredients"),
        recipeIngredientHint: say("recipeIngredientHint"),
        recipeRemoveLine: say("recipeRemoveLine"),
        recipeAddLine: say("recipeAddLine"),
        save: say("save"),
        recipeDelete: say("recipeDelete"),
    }) as const
