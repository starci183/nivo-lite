import { Text, TextAction } from "@starci/grammar/common";

/** Rank and title for one trending result. */
export type TrendingContentRowData = { readonly id: string; readonly rank?: string; readonly title?: string; readonly isTopRank?: boolean }
/** Journey reported when the reader opens the ranked result. */
export type TrendingContentRowActions = { readonly open?: () => void }
/** Props for the ranked-result row. */
export type TrendingContentRowProps = { readonly props: TrendingContentRowData; readonly on?: TrendingContentRowActions; readonly isLoading?: boolean }

/** Render one ranked actionable title. */
export const TrendingContentRow = (props: TrendingContentRowProps) => (
    <div>
        <Text size="sm" tone={props.props.isTopRank === true ? "accent" : "muted"} weight="semibold" isSkeleton={props.isLoading}>{props.props.rank}</Text>
        <TextAction size="sm" isSkeleton={props.isLoading} onPress={props.on?.open}>{props.props.title ?? ""}</TextAction>
    </div>
)
