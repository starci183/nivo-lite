import { Badge, DescriptionList, Section, Stack, Text } from "@starci/grammar/common"
import type { InboxCopy } from "@/modules/inbox"
import type { InboxDetailView, InboxFactView } from "@/modules/types"

/** Props for {@link InboxAside}. */
export interface InboxAsideProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly detail: InboxDetailView
    }
}

/** The facts of one section as terms and values. */
const FactList = (props: { readonly facts: ReadonlyArray<InboxFactView> }) => (
    <DescriptionList
        isDivided
        items={props.facts.map((fact) => ({ id: fact.id, term: fact.term, description: fact.text }))}
    />
)

/** The orders and payments of the customer: each with its number, value, what it holds and where it stands; before the first one, a short note. */
const Orders = (props: InboxAsideProps) => {
    const { copy, detail } = props.props
    if (detail.orders.length === 0) {
        return (
            <Stack gap="identity">
                <Text isStrong>{copy.noOrderTitle}</Text>
                <Text size="sm" tone="muted">
                    {copy.noOrderBody}
                </Text>
            </Stack>
        )
    }
    return (
        <Stack gap="row">
            {detail.orders.map((order) => (
                <Stack key={order.id} gap="identity">
                    <Text isStrong>{order.title}</Text>
                    {order.description === "" ? null : (
                        <Text size="sm" tone="muted">
                            {order.description}
                        </Text>
                    )}
                    <Badge tone={order.badge.tone}>{order.badge.label}</Badge>
                </Stack>
            ))}
        </Stack>
    )
}

/** The side of the opened customer: who they are, where they came from, and their orders and payments. */
export const InboxAside = (props: InboxAsideProps) => {
    const { copy, detail } = props.props
    return (
        <>
            <Section title={copy.asideCustomer} headingLevel={2}>
                <FactList facts={detail.customerFacts} />
            </Section>
            <Section title={copy.asideSource} headingLevel={2}>
                <FactList facts={detail.sourceFacts} />
            </Section>
            <Section title={copy.asideOrders} headingLevel={2}>
                <Orders {...props} />
            </Section>
        </>
    )
}
