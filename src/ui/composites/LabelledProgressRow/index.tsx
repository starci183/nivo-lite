import { Progress, Text } from "@starci/grammar/common";



/** Resolved label and completion figure for a progress row. */
export type LabelledProgressRowData = { readonly id: string; readonly title?: string; readonly percent?: number; readonly percentText?: string }
/** Props for one labelled progress row. */
export type LabelledProgressRowProps = { readonly props: LabelledProgressRowData; readonly isLoading?: boolean }

/** Render a progress label, figure, and accessible bar. */
export const LabelledProgressRow = (props: LabelledProgressRowProps) => (
    <div>
        <div>
            <Text size="sm" weight="semibold" isSkeleton={props.isLoading}>{props.props.title}</Text>
            <Text size="xs" isSkeleton={props.isLoading}>{props.props.percentText}</Text>
        </div>
        <Progress label={props.props.title ?? ""} value={props.props.percent} isSkeleton={props.isLoading} />
    </div>
)
