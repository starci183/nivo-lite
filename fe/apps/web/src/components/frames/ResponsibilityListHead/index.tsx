import { IconButton, Popover, Text } from "@starci/grammar/common"
import { ResponsibilityFilters } from "@/components/composites/ResponsibilityFilters"
import type { ResponsibilityFiltersProps } from "@/components/composites/ResponsibilityFilters"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the end of the list head draws and asks. */
interface ResponsibilityListHeadProps {
    readonly count: string
    readonly filtersLabel: string
    readonly filtersTitle: string
    readonly isOpen: boolean
    readonly onOpenChange: (isOpen: boolean) => void
    readonly filters: ResponsibilityFiltersProps
}

/** The count and the filters button at the end of the list head; the panel behind the button narrows the rows at once. */
export const ResponsibilityListHead = (props: ResponsibilityListHeadProps) => (
    <>
        <Text size="xs" tone="muted">
            {props.count}
        </Text>
        <Popover
            isOpen={props.isOpen}
            onOpenChange={props.onOpenChange}
            placement="bottom"
            label={props.filtersTitle}
            trigger={
                <IconButton intent="neutral" source={nivoIconSource("filter", "leading")} label={props.filtersLabel} />
            }
        >
            <ResponsibilityFilters {...props.filters} />
        </Popover>
    </>
)
