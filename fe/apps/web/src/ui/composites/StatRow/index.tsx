import { nivoIconSource, type IconName } from "../../leaves/Icon";
import { Icon, Text } from "@starci/grammar/common";



/** Resolved icon, label, and figure for one statistic. */
export type StatRowData = { readonly icon: IconName; readonly label: string; readonly value?: string }
/** Props for one statistic row. */
export type StatRowProps = { readonly props: StatRowData; readonly isLoading?: boolean }

/** Render one standing figure with its meaning. */
export const StatRow = (props: StatRowProps) => (
    <div>
        <Icon source={nivoIconSource(props.props.icon, "leading")} usage="leading" />
        <Text size="md">{props.props.label}</Text>
        <Text size="xs" isSkeleton={props.isLoading}>{props.props.value}</Text>
    </div>
)
