import { InventoryPick } from "@/components/leaves/InventoryPick"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Drawer, Text } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME, LINE_ROW_CLASS_NAME } from "./classNames"

/** One ingredient line of the recipe form. */
interface RecipeLineFormView {
    readonly key: string
    readonly itemId: string
    readonly qty: string
    readonly unit: string
}

/** The words and state of the recipe drawer. */
export interface InventoryRecipeDrawerProps {
    readonly props: {
        readonly say: InventorySay
        /** The name of the recipe being changed, or null when a new one is added. */
        readonly editing: string | null
        readonly name: string
        readonly aliases: string
        readonly lines: ReadonlyArray<RecipeLineFormView>
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly isPending: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly name: (value: string) => void
        readonly aliases: (value: string) => void
        readonly item: (index: number, itemId: string) => void
        readonly qty: (index: number, value: string) => void
        readonly removeLine: (index: number) => void
        readonly addLine: () => void
        readonly save: () => void
        readonly remove: () => void
        readonly close: () => void
    }
}

/** The form that adds or changes one recipe and its ingredients. */
export const InventoryRecipeDrawer = (props: InventoryRecipeDrawerProps) => {
    const { props: p, on } = props
    const say = p.say
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={p.editing === null ? say("recipeAddTitle") : say("recipeEditTitle", { name: p.editing })}
            description={say("recipeDrawerHint")}
            closeLabel={say("close")}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                <InventoryField
                    id="rc-name"
                    name="name"
                    label={say("recipeName")}
                    hint={say("recipeNameHint")}
                    value={p.name}
                    onChange={on.name}
                />
                <InventoryField
                    id="rc-alias"
                    name="aliases"
                    label={say("recipeAliases")}
                    hint={say("recipeAliasesHint")}
                    value={p.aliases}
                    onChange={on.aliases}
                />
                <Text weight="semibold">{say("recipeIngredients")}</Text>
                {p.lines.map((line, index) => (
                    <div key={line.key} className={LINE_ROW_CLASS_NAME}>
                        <InventoryPick
                            selectLabel={say("recipeIngredient", { n: index + 1 })}
                            selectHint={say("recipeIngredientHint")}
                            itemId={line.itemId}
                            options={p.items}
                            qtyId={`rl-q-${line.key}`}
                            qtyName={`rq-${line.key}`}
                            qtyLabel={say("recipeQty", { unit: line.unit })}
                            qty={line.qty}
                            onPick={(value) => on.item(index, value)}
                            onQty={(value) => on.qty(index, value)}
                        />
                        <Button variant="ghost" size="sm" onPress={() => on.removeLine(index)}>
                            {say("recipeRemoveLine")}
                        </Button>
                    </div>
                ))}
                <div>
                    <Button variant="ghost" size="sm" onPress={on.addLine}>
                        {say("recipeAddLine")}
                    </Button>
                </div>
                <InventoryNotices error={p.error} />
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="primary" isPending={p.isPending} onPress={on.save}>
                        {say("save")}
                    </Button>
                    {p.editing === null ? null : (
                        <Button variant="danger-soft" isDisabled={p.isPending} onPress={on.remove}>
                            {say("recipeDelete")}
                        </Button>
                    )}
                </div>
            </div>
        </Drawer>
    )
}
