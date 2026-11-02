import type { ContentViews } from "@/modules/types"
import { Button, Cluster, Text } from "@starci/grammar/common"

/** Props of {@link ContentMonthBar}. */
interface ContentMonthBarProps {
    /** The month title, already formatted. */
    readonly title: string
    readonly isLoading: boolean
    readonly copy: ContentViews["workbenchCopy"]
    /** Moves the month by -1 or +1. */
    readonly onShift: (by: number) => void
    /** Goes back to the current month. */
    readonly onToday: () => void
}

/** Previous month, the month title, next month and "today". */
export const ContentMonthBar = (props: ContentMonthBarProps) => (
    <Cluster gap="inline">
        <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={() => props.onShift(-1)}>
            {props.copy.prevMonth}
        </Button>
        <Text isLoading={props.isLoading} isStrong>
            {props.title}
        </Text>
        <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={() => props.onShift(1)}>
            {props.copy.nextMonth}
        </Button>
        <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={props.onToday}>
            {props.copy.today}
        </Button>
    </Cluster>
)
