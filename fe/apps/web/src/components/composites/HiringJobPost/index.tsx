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
    /** The job is still being read: the same anatomy draws as geometry. */
    readonly isLoading?: boolean
}

/** Unseen text that gives each skeleton line the width of a real one. */
const GHOST_POST = {
    company: "M".repeat(16),
    title: "M".repeat(28),
    facts: ["M".repeat(10), "M".repeat(12), "M".repeat(10)],
    description: "M".repeat(160),
    experience: null,
    lists: [{ title: "M".repeat(10), items: ["M".repeat(30), "M".repeat(24)] }],
}

/** Draws the post a candidate reads before applying: the company, the title, the plain facts, the description and the requirement lists. */
export const HiringJobPost = (props: HiringJobPostProps) => {
    const isLoading = props.isLoading === true
    const { company, title, facts, cardLabel, description, experience, lists } = isLoading
        ? { ...props.props, ...GHOST_POST }
        : props.props
    return (
        <Stack gap="section">
            <Stack gap="identity">
                <Text size="sm" tone="muted" isLoading={isLoading}>
                    {company}
                </Text>
                <Heading level={1} isLoading={isLoading}>
                    {title}
                </Heading>
                <Cluster gap="inline">
                    {facts.map((fact) => (
                        <Badge key={fact} tone="neutral" isLoading={isLoading}>
                            {fact}
                        </Badge>
                    ))}
                </Cluster>
            </Stack>
            <SurfaceCard label={cardLabel} headingLevel={2} isLoading={isLoading}>
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
        </Stack>
    )
}
