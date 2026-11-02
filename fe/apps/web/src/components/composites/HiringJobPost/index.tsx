import { Badge, Cluster, EmptyNotice, Heading, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { PRE_WRAP_CLASS_NAME } from "./classNames"

/** A public job post, every word already resolved. */
export interface HiringJobPostProps {
    readonly props: {
        readonly company: string
        readonly title: string
        readonly facts: ReadonlyArray<string>
        readonly cardLabel: string
        readonly description: string
        readonly experience: string | null
        readonly lists: ReadonlyArray<{ readonly title: string; readonly items: ReadonlyArray<string> }>
    }
}

/** Draws the post a candidate reads before applying: the company, the title, the plain facts, the description and the requirement lists. */
export const HiringJobPost = (props: HiringJobPostProps) => {
    const { company, title, facts, cardLabel, description, experience, lists } = props.props
    return (
        <>
            <Stack gap="identity">
                <Text size="sm" tone="muted">
                    {company}
                </Text>
                <Heading level={1}>{title}</Heading>
                <Cluster gap="inline">
                    {facts.map((fact) => (
                        <Badge key={fact} tone="neutral">
                            {fact}
                        </Badge>
                    ))}
                </Cluster>
            </Stack>
            <SurfaceCard ariaLabel={cardLabel}>
                <Stack gap="section">
                    {description === "" ? null : (
                        <div className={PRE_WRAP_CLASS_NAME}>
                            <Text size="sm">{description}</Text>
                        </div>
                    )}
                    {lists
                        .filter((list) => list.items.length > 0)
                        .map((list) => (
                            <Section
                                key={list.title}
                                kind="list"
                                title={list.title}
                                headingLevel={3}
                                items={list.items.map((item) => ({ id: item, title: item }))}
                                empty={<EmptyNotice message={list.title} />}
                            />
                        ))}
                    {experience === null ? null : <Text>{experience}</Text>}
                </Stack>
            </SurfaceCard>
        </>
    )
}
