import { Button, IconButton, List, ListRow, Popover, Text, TextAction } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PANEL } from "./classNames"

/** The words of the bell, resolved by the caller. */
type ConsoleNotificationsCopy = {
    readonly bell: string
    readonly title: string
    readonly nothingWaiting: string
    readonly openOffice: string
}

/** What the bell draws and reports. */
type ConsoleNotificationsProps = {
    readonly count: number
    readonly pending: ReadonlyArray<ConsolePending>
    readonly copy: ConsoleNotificationsCopy
    readonly isOpen: boolean
    readonly onOpenChange: (isOpen: boolean) => void
    readonly onOpenOffice: () => void
}

/** The approvals waiting for a person: a bell with the real count that opens the five newest and the way to the Office. */
export const ConsoleNotifications = (props: ConsoleNotificationsProps) => (
    <Popover
        isOpen={props.isOpen}
        onOpenChange={props.onOpenChange}
        placement="bottom"
        title={props.copy.title}
        trigger={
            <IconButton
                intent="neutral"
                source={nivoIconSource("notification", "leading")}
                label={props.copy.bell}
                badge={props.count}
                badgeLabel={props.copy.title}
            />
        }
    >
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
                                <TextAction
                                    href={item.href}
                                    appearance="inline"
                                    onFollow={() => props.onOpenChange(false)}
                                >
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
    </Popover>
)
