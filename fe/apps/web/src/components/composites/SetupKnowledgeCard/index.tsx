import { Cluster, Heading, List, ListItem, Region, Stack, Text, TextAction } from "@starci/grammar/common"

/** The knowledge this module runs on, in the reader language. */
type SetupKnowledgeCardProps = {
    readonly title: string
    readonly businessLine: string
    readonly publicLine: string
    readonly emptyHint: string
    readonly knowledgeHref: string
    readonly knowledgeLabel: string
    readonly nivoHref: string
    readonly nivoLabel: string
    /** The counts are skeletons until the sources are read. */
    readonly isSkeleton: boolean
}

/** Draws the knowledge this module runs on: the sources of the business, and where to add more. */
export const SetupKnowledgeCard = (props: SetupKnowledgeCardProps) => (
    <Region label={props.title}>
        <Stack gap="row">
            <Heading level={2}>{props.title}</Heading>
            <List label={props.title}>
                <ListItem>
                    <Text size="sm" isSkeleton={props.isSkeleton}>
                        {props.businessLine}
                        {props.publicLine === "" ? null : (
                            <Text as="span" size="sm" tone="muted">
                                {" "}
                                ({props.publicLine})
                            </Text>
                        )}
                    </Text>
                </ListItem>
            </List>
            {props.emptyHint === "" ? null : (
                <Text size="xs" tone="muted">
                    {props.emptyHint}
                </Text>
            )}
            <Cluster gap="row">
                <TextAction href={props.knowledgeHref} size="sm" appearance="inline">
                    {props.knowledgeLabel}
                </TextAction>
                <TextAction href={props.nivoHref} size="sm" appearance="muted">
                    {props.nivoLabel}
                </TextAction>
            </Cluster>
        </Stack>
    </Region>
)
