import { Text, TextAction, Badge, type BadgeTone } from "@starci/grammar/common";
import { META_CLASS_NAME, ROOT_CLASS_NAME } from "./classNames";

/** Public ChangelogEntryRowData declaration. */
export type ChangelogEntryRowData = {readonly id: string;readonly dateLabel?: string;readonly categoryLabel?: string;readonly categoryTone?: BadgeTone;readonly title?: string;readonly body?: string;readonly isAction?: boolean;};
/** Public ChangelogEntryRowActions declaration. */
export type ChangelogEntryRowActions = {readonly open?: () => void;};
/** Public ChangelogEntryRowProps declaration. */
export type ChangelogEntryRowProps = {readonly props: ChangelogEntryRowData;readonly on?: ChangelogEntryRowActions;readonly isLoading?: boolean;};

/** Public ChangelogEntryRow declaration. */
export const ChangelogEntryRow = (props: ChangelogEntryRowProps) => ChangelogEntryRowView(props);
const ChangelogEntryRowView = ({ props, on, isLoading = false }: ChangelogEntryRowProps) =>
<div className={ROOT_CLASS_NAME}>
        <div className={META_CLASS_NAME}>
            <Text size="xs" tone="muted" isSkeleton={isLoading}>{props.dateLabel}</Text>
            {props.categoryLabel === undefined ? null : <Badge tone={props.categoryTone} isSkeleton={isLoading}>{props.categoryLabel}</Badge>}
        </div>
        {props.isAction === true && on?.open !== undefined ? <TextAction size="sm" isSkeleton={isLoading} onPress={on.open}>{props.title ?? ""}</TextAction> : <Text size="sm" weight="medium" isSkeleton={isLoading}>{props.title}</Text>}
        {props.body === undefined && !isLoading ? null : <Text size="xs" tone="muted" isSkeleton={isLoading}>{props.body}</Text>}
    </div>;
