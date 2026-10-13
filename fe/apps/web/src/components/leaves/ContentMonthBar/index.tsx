import { Button, Text } from "@starci/grammar/common"
import type { ContentT } from "@/hooks/content"
import { TOOLBAR_CLASS_NAME } from "./classNames"

/** Props of {@link ContentMonthBar}. */
interface ContentMonthBarProps {
    /** The month title, already formatted. */
    readonly title: string
    readonly t: ContentT
    /** Moves the month by -1 or +1. */
    readonly onShift: (by: number) => void
    /** Goes back to the current month. */
    readonly onToday: () => void
}

/** Previous month, the month title, next month and "today". */
export const ContentMonthBar = (props: ContentMonthBarProps) => (
    <div className={TOOLBAR_CLASS_NAME}>
        <Button variant="outline" size="sm" onPress={() => props.onShift(-1)}>
            {props.t("prevMonth")}
        </Button>
        <Text weight="semibold">{props.title}</Text>
        <Button variant="outline" size="sm" onPress={() => props.onShift(1)}>
            {props.t("nextMonth")}
        </Button>
        <Button variant="ghost" size="sm" onPress={props.onToday}>
            {props.t("today")}
        </Button>
    </div>
)
