import { EmptyNotice, Stack, SurfaceCard, Text, Section } from "@starci/grammar/common"

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
    <Section title={props.title} isLoading={props.isLoading}>
        <Stack gap="row">
            {props.summary !== "" || props.isLoading ? (
                <Text size="sm" isLoading={props.isLoading}>
                    {props.summary === "" ? "-" : props.summary}
                </Text>
            ) : null}
            {props.summary === "" && !props.isLoading ? (
                <Text size="sm" tone="muted">
                    {props.emptyText}
                </Text>
            ) : null}
            {props.facts.length > 0 ? (
                <SurfaceCard
                    kind="list"
                    label={props.factsTitle}
                    items={props.facts.map((fact) => ({ id: fact.key, title: fact.text }))}
                    empty={<EmptyNotice message={props.emptyText} />}
                    isLoading={props.isLoading}
                />
            ) : null}
        </Stack>
    </Section>
)
