import { Heading, List, ListItem, Region, Text } from "@starci/grammar/common"
import { FACTS, STACK } from "./classNames"

/** The draft of the setup in the reader language. */
type SetupDraftCardProps = {
    readonly title: string
    readonly summary: string
    readonly emptyText: string
    readonly factsTitle: string
    readonly facts: ReadonlyArray<{ readonly key: string; readonly text: string }>
    readonly isSkeleton: boolean
}

/** The draft being built in the setup chat: the summary of the business and the facts NIVO noted. */
export const SetupDraftCard = (props: SetupDraftCardProps) => (
    <Region label={props.title}>
        <div className={STACK}>
            <Heading level={2}>{props.title}</Heading>
            {props.summary !== "" ? (
                <Text size="sm" isSkeleton={props.isSkeleton}>
                    {props.summary}
                </Text>
            ) : null}
            {props.summary === "" ? (
                <Text size="sm" tone="muted">
                    {props.emptyText}
                </Text>
            ) : null}
            {props.facts.length > 0 ? (
                <>
                    <Heading level={3}>{props.factsTitle}</Heading>
                    <List label={props.factsTitle} className={FACTS}>
                        {props.facts.map((fact) => (
                            <ListItem key={fact.key}>
                                <Text size="sm" isSkeleton={props.isSkeleton}>
                                    {fact.text}
                                </Text>
                            </ListItem>
                        ))}
                    </List>
                </>
            ) : null}
        </div>
    </Region>
)
