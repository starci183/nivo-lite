import type { InventoryCountData, InventoryCountActions } from "@/modules/types"

/** Resolved count fields and atomic commands; the module Base owns read status. */
type InventoryCountProps = InventoryCountData & {
    readonly isLoading: boolean
    readonly onQuery: InventoryCountActions["onQuery"]
    readonly onCount: InventoryCountActions["onCount"]
    readonly onSubmit: InventoryCountActions["onSubmit"]
}
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, EmptyNotice, Input, SearchField, Section, Stack, Text } from "@starci/grammar/common"

/** The stock count tab, made for a phone: type what was counted, leave the rest blank. */
export const InventoryCount = (props: InventoryCountProps) => {
    const on = { query: props.onQuery, count: props.onCount, submit: props.onSubmit }
    return (
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {props.intro}
            </Text>
            <Section
                isLoading={props.isLoading}
                kind="list"
                title={props.listLabel}
                filter={
                    <SearchField
                        isLoading={props.isLoading}
                        label={props.searchLabel}
                        isLabelHidden
                        placeholder={props.searchPlaceholder}
                        clearLabel={props.clearLabel}
                        value={props.query}
                        onValueChange={on.query}
                        onClear={() => on.query("")}
                    />
                }
                items={props.rows.map((row) => ({
                    id: row.id,
                    title: row.name,
                    description: row.machine,
                    detail: (
                        <Input
                            isLoading={props.isLoading}
                            id={`cnt-${row.id}`}
                            name={`cnt-${row.id}`}
                            label={row.fieldLabel}
                            placeholder={row.unit}
                            value={row.value}
                            onValueChange={(value) => on.count(row.id, value)}
                        />
                    ),
                }))}
                empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
            />
            <InventoryNotices error={props.error} notice={props.notice} />
            <div>
                <Button
                    isLoading={props.isLoading}
                    intent="commit"
                    isPending={props.isPending}
                    isDisabled={!props.canSubmit}
                    onPress={on.submit}
                >
                    {props.submitLabel}
                </Button>
            </div>
        </Stack>
    )
}
