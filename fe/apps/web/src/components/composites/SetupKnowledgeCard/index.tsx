import { Cluster, Link, Stack, Text, Section } from "@starci/grammar/common"

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
    readonly isLoading: boolean
}

/** Draws the knowledge this module runs on: the sources of the business, and where to add more. */
export const SetupKnowledgeCard = (props: SetupKnowledgeCardProps) => (
    <Section title={props.title}>
        <Stack gap="row">
            <Text size="sm" isLoading={props.isLoading}>
                {props.businessLine}
                {props.publicLine === "" ? null : (
                    <Text as="span" size="sm" tone="muted">
                        {" "}
                        ({props.publicLine})
                    </Text>
                )}
            </Text>
            {props.emptyHint === "" ? null : (
                <Text size="xs" tone="muted">
                    {props.emptyHint}
                </Text>
            )}
            <Cluster gap="row">
                <Link href={props.knowledgeHref}>{props.knowledgeLabel}</Link>
                <Link href={props.nivoHref}>{props.nivoLabel}</Link>
            </Cluster>
        </Stack>
    </Section>
)
