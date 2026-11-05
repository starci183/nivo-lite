import { Select, Stack, TextAction, Cluster, Text } from "@starci/grammar/common"
import type { ResponsibilitiesBoardCopy } from "@/modules/types"

/** One choice of a select. */
interface ResponsibilityFilterChoice {
    readonly id: string
    readonly label: string
}

/** The words of the filters panel. */
type ResponsibilityFiltersCopy = ResponsibilitiesBoardCopy["filters"]

/** What the filters panel draws and asks. */
export interface ResponsibilityFiltersProps {
    readonly copy: ResponsibilityFiltersCopy
    readonly owners: ReadonlyArray<ResponsibilityFilterChoice>
    readonly owner: string
    readonly dues: ReadonlyArray<ResponsibilityFilterChoice>
    readonly due: string
    readonly sorts: ReadonlyArray<ResponsibilityFilterChoice>
    readonly sort: string
    readonly onOwner: (value: string | null) => void
    readonly onDue: (value: string | null) => void
    readonly onSort: (value: string | null) => void
    readonly onClear: () => void
}

/** The panel behind the filters button: owner, due and order, each applied at once, and the way to clear them. */
export const ResponsibilityFilters = (props: ResponsibilityFiltersProps) => (
    <Stack gap="row">
        <Select
            label={props.copy.ownerLabel}
            options={props.owners}
            value={props.owner}
            onValueChange={props.onOwner}
        />
        <Select label={props.copy.dueLabel} options={props.dues} value={props.due} onValueChange={props.onDue} />
        <Select label={props.copy.sortLabel} options={props.sorts} value={props.sort} onValueChange={props.onSort} />
        <Cluster gap="row" justify="between">
            <TextAction onPress={props.onClear}>{props.copy.clear}</TextAction>
            <Text size="xs" tone="muted">
                {props.copy.live}
            </Text>
        </Cluster>
    </Stack>
)
