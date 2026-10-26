import { InventoryRecipeDrawer } from "@/components/composites/InventoryRecipeDrawer"
import type { InventoryRecipeDrawerProps } from "@/components/composites/InventoryRecipeDrawer"
import { Button, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { STACK_CLASS_NAME } from "./classNames"

/** One recipe row, every word already resolved. */
export interface RecipeRowView {
    readonly id: string
    readonly title: string
    readonly detail: string
}

/** The words and data of the recipes tab. */
export interface InventoryRecipesBaseProps {
    readonly props: {
        readonly addLabel: string | null
        readonly addDisabled: boolean
        readonly editLabel: string | null
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<RecipeRowView>
        /** The drawer while it is open. */
        readonly drawer: InventoryRecipeDrawerProps["props"] | null
    }
    readonly on: {
        readonly add: () => void
        readonly edit: (id: string) => void
        readonly recipeName: (value: string) => void
        readonly recipeAliases: (value: string) => void
        readonly recipeItem: (index: number, itemId: string) => void
        readonly recipeQty: (index: number, value: string) => void
        readonly recipeRemoveLine: (index: number) => void
        readonly recipeAddLine: () => void
        readonly recipeSave: () => void
        readonly recipeRemove: () => void
        readonly recipeClose: () => void
    }
}

/** The recipes tab: what one product on an order takes out of stock. */
export const InventoryRecipesBase = (props: InventoryRecipesBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={STACK_CLASS_NAME}>
            {p.addLabel === null ? null : (
                <div>
                    <Button intent="commit" size="sm" isDisabled={p.addDisabled} onPress={on.add}>
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
                        title={row.title}
                        description={row.detail}
                        actions={
                            p.editLabel === null ? undefined : (
                                <Button intent="neutral" size="sm" onPress={() => on.edit(row.id)}>
                                    {p.editLabel}
                                </Button>
                            )
                        }
                    />
                ))}
            </SurfaceListCard>
            {p.drawer === null ? null : (
                <InventoryRecipeDrawer
                    props={p.drawer}
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
        </div>
    )
}
