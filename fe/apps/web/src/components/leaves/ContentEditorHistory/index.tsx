import { SectionHeader, Text, Timeline } from "@starci/grammar/common"
import type { ContentT, HistoryRow } from "@/hooks/content"

/** Props of {@link ContentEditorHistory}. */
interface ContentEditorHistoryProps {
    readonly rows: ReadonlyArray<HistoryRow>
    readonly t: ContentT
}

/** What happened to a post, newest first. */
export const ContentEditorHistory = (props: ContentEditorHistoryProps) => (
    <>
        <SectionHeader level={3} title={props.t("evidenceTitle")} />
        {props.rows.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.t("evidenceEmpty")}
            </Text>
        ) : (
            <Timeline
                label={props.t("evidenceTitle")}
                items={props.rows.map((row) => ({ id: row.id, title: row.text, dateTime: row.at, timeLabel: row.timeLabel }))}
            />
        )}
    </>
)
