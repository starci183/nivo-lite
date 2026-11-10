import { Badge, DescriptionList, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { InboxCopy } from "@/modules/inbox"
import type { InboxDetailView } from "@/modules/types"

/** Props for {@link InboxNeedsCard}. */
export interface InboxNeedsCardProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly detail: InboxDetailView
    }
}

/** What the customer needs: the AI summary in a sentence, then the facts the agent pulled out of the form and the messages. */
export const InboxNeedsCard = (props: InboxNeedsCardProps) => {
    const { copy, detail } = props.props
    return (
        <SurfaceCard label={copy.needsTitle} labelEnd={<Badge tone="accent">{copy.needsAi}</Badge>}>
            <Stack gap="row">
                <Text size="sm" tone="muted">
                    {copy.needsHint}
                </Text>
                <Text>{detail.needsSummary}</Text>
                {detail.needsFacts.length === 0 ? null : (
                    <DescriptionList
                        isDivided
                        items={detail.needsFacts.map((fact) => ({
                            id: fact.id,
                            term: fact.term,
                            description: fact.text,
                        }))}
                    />
                )}
            </Stack>
        </SurfaceCard>
    )
}
