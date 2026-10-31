import { Cluster, DescriptionList, Text } from "@starci/grammar/common"
import type { OfficeResultCardView, OfficeText } from "@/modules/types"

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
        {props.card.lines.length === 0 ? null : (
            <DescriptionList
                layout="columns"
                items={props.card.lines.map((line) => ({
                    id: `${line.at}-${line.text}`,
                    term: line.at,
                    description: <Text size="sm">{line.text}</Text>,
                }))}
            />
        )}
        {props.card.sources.length === 0 ? null : (
            <Cluster gap="inline">
                <Text size="xs" tone="muted" weight="medium">
                    {props.text("cardSources")}
                </Text>
                <Text size="xs" tone="muted">
                    {props.card.sources.map((source) => source.label).join(" · ")}
                </Text>
            </Cluster>
        )}
    </>
)
