import { DescriptionList, Text } from "@starci/grammar/common"
import type { OfficeResultCardView, OfficeText } from "@/modules/types"
import { LINE_CLASS_NAME, SOURCES_CLASS_NAME } from "./classNames"

/** What the details of a result card draw. */
type OfficeCardDetailsProps = {
    readonly card: OfficeResultCardView
    readonly text: OfficeText
}

/** The labelled rows, the timed lines and the sources the agent used, under a result card. */
export const OfficeCardDetails = (props: OfficeCardDetailsProps) => (
    <>
        {props.card.fields.length === 0 ? null : (
            <DescriptionList
                layout="stacked"
                items={props.card.fields.map((field) => ({
                    id: field.label,
                    term: field.label,
                    description: <Text weight="medium">{field.value}</Text>,
                }))}
            />
        )}
        {props.card.lines.map((line) => (
            <div key={`${line.at}-${line.text}`} className={LINE_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {line.at}
                </Text>
                <Text size="sm">{line.text}</Text>
            </div>
        ))}
        {props.card.sources.length === 0 ? null : (
            <div className={SOURCES_CLASS_NAME}>
                <Text size="xs" tone="muted" weight="medium">
                    {props.text("cardSources")}
                </Text>
                <Text size="xs" tone="muted">
                    {props.card.sources.map((source) => source.label).join(" · ")}
                </Text>
            </div>
        )}
    </>
)
