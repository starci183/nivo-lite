import { Button, List, ListRow, Text, TextAction } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"
import { PANEL } from "./classNames"

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
            <List label={props.copy.title}>
                {props.pending.slice(0, 5).map((item) => (
                    <ListRow
                        key={item.id}
                        title={
                            <TextAction href={item.href} appearance="inline" onFollow={props.onClose}>
                                {item.leadName}
                            </TextAction>
                        }
                        description={item.summary}
                    />
                ))}
            </List>
        )}
        <Button intent="neutral" size="sm" width="fill" onPress={props.onOpenOffice}>
            {props.copy.openOffice}
        </Button>
    </div>
)
