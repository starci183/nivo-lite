import { List, ListItem, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { COUNTS, ROW, STACK } from "./classNames"

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
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={STACK}>
            <List label={props.title} className={COUNTS}>
                <ListItem>
                    <Text size="sm" isSkeleton={props.isLoading}>
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
            <div className={ROW}>
                <TextAction href={props.knowledgeHref} size="sm" appearance="inline">
                    {props.knowledgeLabel}
                </TextAction>
                <TextAction href={props.nivoHref} size="sm" appearance="muted">
                    {props.nivoLabel}
                </TextAction>
            </div>
        </div>
    </SurfaceCard>
)
