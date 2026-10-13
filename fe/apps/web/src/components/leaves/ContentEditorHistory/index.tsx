import { SectionHeader, Text, Timeline } from "@starci/grammar/common"
import type { ContentT, HistoryRow } from "@/hooks/content"

/** Props of {@link ContentEditorHistory}. */
interface ContentEditorHistoryProps {
    readonly rows: ReadonlyArray<HistoryRow>
    readonly t: ContentT
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
        <>
            <SectionHeader level={3} title={props.t("evidenceTitle")} />
            {items.length > 0 ? (
                <Timeline label={props.t("evidenceTitle")} items={items} />
            ) : (
                <Text size="sm" tone="muted">
                    {props.t("evidenceEmpty")}
                </Text>
            )}
        </>
    )
}
