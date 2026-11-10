import { Badge, Cluster, Section } from "@starci/grammar/common"
import type { AgentGraphHeadView } from "@/modules/types"

/** The band over the graph: its title and the marks of the map. */
type AgentGraphHeadProps = {
    readonly view: AgentGraphHeadView
    readonly isLoading: boolean
}

/** The title of the work map and its version and mode marks; where it stands and "Publish" live in the progress card below. */
export const AgentGraphHead = (props: AgentGraphHeadProps) => (
    <Section headingLevel={2} title={props.view.title} isLoading={props.isLoading}>
        <Cluster gap="inline">
            {props.view.badges.map((badge) => (
                <Badge key={badge.text} tone={badge.tone} isLoading={props.isLoading}>
                    {badge.text}
                </Badge>
            ))}
        </Cluster>
    </Section>
)
