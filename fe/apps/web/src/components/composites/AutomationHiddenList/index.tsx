import { Button, Disclosure, List, ListRow } from "@starci/grammar/common"

/** One automation the owner hid. */
type AutomationHiddenItem = {
    readonly key: string
    readonly name: string
    readonly isBusy: boolean
}

/** What the list of hidden automations shows. */
type AutomationHiddenListProps = {
    readonly title: string
    readonly restoreLabel: string
    readonly items: ReadonlyArray<AutomationHiddenItem>
    readonly onRestore: (key: string) => void
}

/** The automations the owner marked "not for me", each with its restore action; nothing when none is hidden. */
export const AutomationHiddenList = (props: AutomationHiddenListProps) =>
    props.items.length === 0 ? null : (
        <Disclosure title={props.title}>
            <List label={props.title}>
                {props.items.map((item) => (
                    <ListRow
                        key={item.key}
                        title={item.name}
                        actions={
                            <Button
                                intent="neutral"
                                size="sm"
                                isDisabled={item.isBusy}
                                onPress={() => props.onRestore(item.key)}
                            >
                                {props.restoreLabel}
                            </Button>
                        }
                    />
                ))}
            </List>
        </Disclosure>
    )
