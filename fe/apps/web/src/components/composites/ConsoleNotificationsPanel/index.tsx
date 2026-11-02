import { Button, Section, Stack, Text } from "@starci/grammar/common"
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
        <Stack gap="row">
            {props.count === 0 ? (
                <Text tone="muted" size="sm">
                    {props.copy.nothingWaiting}
                </Text>
            ) : (
                <Section
                    kind="list"
                    title={props.copy.title}
                    headingLevel={3}
                    items={props.pending.slice(0, 5).map((item) => ({
                        id: item.id,
                        title: item.leadName,
                        description: item.summary,
                        href: item.href,
                        onFollow: props.onClose,
                    }))}
                    empty={
                        <Text size="sm" tone="muted">
                            {props.copy.nothingWaiting}
                        </Text>
                    }
                />
            )}
            <Button intent="neutral" size="sm" width="fill" onPress={props.onOpenOffice}>
                {props.copy.openOffice}
            </Button>
        </Stack>
    </div>
)
