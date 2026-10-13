import { Badge, Heading, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import {
    CARD_CLASS_NAME,
    FACTS_CLASS_NAME,
    HEAD_CLASS_NAME,
    LIST_BLOCK_CLASS_NAME,
    PRE_WRAP_CLASS_NAME,
} from "./classNames"

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
            <div className={HEAD_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {company}
                </Text>
                <Heading level={1}>{title}</Heading>
                <div className={FACTS_CLASS_NAME}>
                    {facts.map((fact) => (
                        <Badge key={fact} tone="neutral">
                            {fact}
                        </Badge>
                    ))}
                </div>
            </div>
            <SurfaceCard ariaLabel={cardLabel}>
                <div className={CARD_CLASS_NAME}>
                    {description === "" ? null : (
                        <div className={PRE_WRAP_CLASS_NAME}>
                            <Text size="sm">{description}</Text>
                        </div>
                    )}
                    {lists
                        .filter((list) => list.items.length > 0)
                        .map((list) => (
                            <div key={list.title} className={LIST_BLOCK_CLASS_NAME}>
                                <Text weight="semibold">{list.title}</Text>
                                <List label={list.title}>
                                    {list.items.map((item) => (
                                        <ListItem key={item}>
                                            <Text>{item}</Text>
                                        </ListItem>
                                    ))}
                                </List>
                            </div>
                        ))}
                    {experience === null ? null : <Text>{experience}</Text>}
                </div>
            </SurfaceCard>
        </>
    )
}
