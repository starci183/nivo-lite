import { Button, Disclosure, List, ListItem, Text } from "@starci/grammar/common"
import { HIDDEN_ROW_CLASS, ROWS_CLASS } from "./classNames"

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
            <List label={props.title} className={ROWS_CLASS}>
                {props.items.map((item) => (
                    <ListItem key={item.key} className={HIDDEN_ROW_CLASS}>
                        <Text size="sm">{item.name}</Text>
                        <Button
                            variant="outline"
                            size="sm"
                            isDisabled={item.isBusy}
                            onPress={() => props.onRestore(item.key)}
                        >
                            {props.restoreLabel}
                        </Button>
                    </ListItem>
                ))}
            </List>
        </Disclosure>
    )
