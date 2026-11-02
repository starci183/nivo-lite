import { Text, Timeline, Section } from "@starci/grammar/common"
import type { HistoryRow, ContentViews } from "@/modules/types"

/** Props of {@link ContentEditorHistory}. */
interface ContentEditorHistoryProps {
    readonly rows: ReadonlyArray<HistoryRow>
    readonly copy: ContentViews["workbenchCopy"]
}

/** What happened to a post, newest first. */
export const ContentEditorHistory = (props: ContentEditorHistoryProps) => {
    const items = props.rows.map((row) => ({
        id: row.id,
        title: row.text,
        dateTime: row.at,
        timeLabel: row.timeLabel,
    }))

    return (
        <Section title={props.copy.evidenceTitle} headingLevel={3}>
            {items.length > 0 ? (
                <Timeline label={props.copy.evidenceTitle} items={items} />
            ) : (
                <Text size="sm" tone="muted">
                    {props.copy.evidenceEmpty}
                </Text>
            )}
        </Section>
    )
}
