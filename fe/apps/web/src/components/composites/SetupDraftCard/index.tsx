import { Heading, List, ListItem, Skeleton, SurfaceCard, Text } from "@starci/grammar/common"
import { FACTS, STACK } from "./classNames"

/** The draft of the setup in the reader language. */
type SetupDraftCardProps = {
    readonly title: string
    readonly summary: string
    readonly emptyText: string
    readonly factsTitle: string
    readonly facts: ReadonlyArray<{ readonly key: string; readonly text: string }>
    readonly isLoading: boolean
}

/** The draft being built in the setup chat: the summary of the business and the facts NIVO noted. */
export const SetupDraftCard = (props: SetupDraftCardProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={STACK}>
            {props.isLoading ? <Skeleton shape="text" lines={3} /> : null}
            {!props.isLoading && props.summary !== "" ? <Text size="sm">{props.summary}</Text> : null}
            {!props.isLoading && props.summary === "" ? (
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
                                <Text size="sm">{fact.text}</Text>
                            </ListItem>
                        ))}
                    </List>
                </>
            ) : null}
        </div>
    </SurfaceCard>
)
