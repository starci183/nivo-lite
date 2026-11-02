import { Cluster, DescriptionList, Text } from "@starci/grammar/common"
import type { OfficeResultCardView, OfficeThreadProps } from "@/modules/types"

/** What the details of a result card draw. */
type OfficeCardDetailsProps = {
    readonly card: OfficeResultCardView
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["result"]
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
                    description: <Text isStrong>{field.value}</Text>,
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
                <Text size="xs" tone="muted" isStrong>
                    {props.copy.cardSources}
                </Text>
                <Text size="xs" tone="muted">
                    {props.card.sources.map((source) => source.label).join(" · ")}
                </Text>
            </Cluster>
        )}
    </>
)
