import { Button, List, ListItem, Text, TextAction } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"
import { ITEM, LIST, PANEL } from "./classNames"

/** The words of the bell, resolved by the caller. */
type ConsoleNotificationsCopy = {
    readonly bell: string
    readonly title: string
    readonly nothingWaiting: string
    readonly openOffice: string
}

/** What the bell's panel draws and reports. */
type ConsoleNotificationsPanelProps = {
    readonly count: number
    readonly pending: ReadonlyArray<ConsolePending>
    readonly copy: ConsoleNotificationsCopy
    readonly onClose: () => void
    readonly onOpenOffice: () => void
}

/** The approvals waiting for a person: the five newest and the way to the Office, shown in the bell's popover. */
export const ConsoleNotificationsPanel = (props: ConsoleNotificationsPanelProps) => (
    <div className={PANEL}>
        {props.count === 0 ? (
            <Text tone="muted" size="sm">
                {props.copy.nothingWaiting}
            </Text>
        ) : (
            <List label={props.copy.title} className={LIST}>
                {props.pending.slice(0, 5).map((item) => (
                    <ListItem key={item.id} className={ITEM}>
                        <TextAction href={item.href} appearance="inline" onFollow={props.onClose}>
                            {item.leadName}
                        </TextAction>
                        <Text size="sm" tone="muted" overflow="clamp-2">
                            {item.summary}
                        </Text>
                    </ListItem>
                ))}
            </List>
        )}
        <Button variant="outline" size="sm" width="fill" onPress={props.onOpenOffice}>
            {props.copy.openOffice}
        </Button>
    </div>
)
