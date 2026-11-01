import { Button } from "@starci/grammar/common"
import { FILTER_ROW_CLASS_NAME } from "./classNames"

/** One filter: what it is called and how many items it keeps. */
export interface FilterButtonView {
    readonly id: string
    readonly label: string
}

/** What the row of filters says and calls. */
interface FilterButtonsProps {
    /** Names the group for assistive technology. */
    readonly label: string
    readonly options: ReadonlyArray<FilterButtonView>
    /** The id of the filter that is on. */
    readonly value: string
    readonly onValueChange: (id: string) => void
}

/**
 * One row of filters, each a small button that is pressed while it is the one on. This is the one place the app draws a filter
 * row of buttons: until the grammar ships a `FilterButtonGroup`, the swap is this file alone.
 */
export const FilterButtons = (props: FilterButtonsProps) => (
    <div role="group" aria-label={props.label} className={FILTER_ROW_CLASS_NAME}>
        {props.options.map((option) => (
            <Button
                key={option.id}
                size="sm"
                intent="neutral"
                aria-pressed={option.id === props.value}
                onPress={() => props.onValueChange(option.id)}
            >
                {option.label}
            </Button>
        ))}
    </div>
)
