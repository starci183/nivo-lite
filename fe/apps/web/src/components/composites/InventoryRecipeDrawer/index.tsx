import type { InventoryRecipeEditorData } from "@/modules/types"
import { InventoryPick } from "@/components/branches/InventoryPick"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Drawer, Text, Stack, Grid, Cluster } from "@starci/grammar/common"

/** The words and state of the recipe drawer. */
interface InventoryRecipeDrawerProps {
    readonly props: InventoryRecipeEditorData
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
    const copy = p.copy
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={p.editing === null ? copy.recipeAddTitle : copy.recipeEditTitle}
            description={copy.recipeDrawerHint}
            closeLabel={copy.close}
            placement="right"
        >
            <Stack gap="row">
                <InventoryField
                    id="rc-name"
                    name="name"
                    label={copy.recipeName}
                    hint={copy.recipeNameHint}
                    value={p.name}
                    onChange={on.name}
                />
                <InventoryField
                    id="rc-alias"
                    name="aliases"
                    label={copy.recipeAliases}
                    hint={copy.recipeAliasesHint}
                    value={p.aliases}
                    onChange={on.aliases}
                />
                <Text isStrong>{copy.recipeIngredients}</Text>
                {p.lines.map((line, index) => (
                    <Grid kind="form" columns={1} key={line.key}>
                        <InventoryPick
                            itemId={line.itemId}
                            options={p.items}
                            qty={line.qty}
                            selectLabel={line.ingredientLabel}
                            selectHint={copy.recipeIngredientHint}
                            qtyId={`rl-q-${line.key}`}
                            qtyName={`rq-${line.key}`}
                            qtyLabel={line.quantityLabel}
                            onPick={(value) => on.item(index, value)}
                            onQty={(value) => on.qty(index, value)}
                        />
                        <Button intent="destructive" step="entry" size="sm" onPress={() => on.removeLine(index)}>
                            {copy.recipeRemoveLine}
                        </Button>
                    </Grid>
                ))}
                <div>
                    <Button intent="neutral" size="sm" onPress={on.addLine}>
                        {copy.recipeAddLine}
                    </Button>
                </div>
                <InventoryNotices error={p.error} />
                <Cluster gap="inline">
                    <Button intent="commit" isPending={p.isPending} onPress={on.save}>
                        {copy.save}
                    </Button>
                    {p.editing === null ? null : (
                        <Button intent="destructive" step="entry" isDisabled={p.isPending} onPress={on.remove}>
                            {copy.recipeDelete}
                        </Button>
                    )}
                </Cluster>
            </Stack>
        </Drawer>
    )
}
