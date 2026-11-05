import { Button, DescriptionList, PaneSection, Quote, Stack, Text } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import type { QueueAsideView } from "@/modules/types"

/** What the side pane draws. */
interface QueueAsideProps {
    readonly aside: QueueAsideView
    readonly isWaiting: boolean
}

/** The side pane of the opened item: its head band, then what it is filed under, the words it rests on and the way to its dossier. */
export const QueueAside = (props: QueueAsideProps) => (
    <>
        <PaneSection align="center">
            <PaneHead title={props.aside.title} headingLevel={2} isLoading={props.isWaiting} />
        </PaneSection>
        <PaneSection gap="section">
            {props.aside.terms.length === 0 ? null : (
                <DescriptionList
                    items={props.aside.terms.map((term) => ({ id: term.id, term: term.term, description: term.text }))}
                    isLoading={props.isWaiting}
                />
            )}
            {props.aside.quotes.length === 0 ? null : (
                <Stack gap="row">
                    <Text isStrong>{props.aside.quotesTitle}</Text>
                    {props.aside.quotes.map((quote) => (
                        <Quote key={quote.id} source={quote.source} text={quote.text} />
                    ))}
                </Stack>
            )}
            {props.aside.action === null ? null : (
                <Button intent="neutral" size="sm" href={props.aside.action.href}>
                    {props.aside.action.label}
                </Button>
            )}
        </PaneSection>
    </>
)
