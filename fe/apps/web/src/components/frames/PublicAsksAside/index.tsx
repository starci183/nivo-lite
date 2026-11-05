import { Button, Cluster, EmptyNotice, PaneSection, Section, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneHead } from "@/components/composites/PaneHead"
import type { DataSlot, PublicAskView, PublicBrainCopy, SlotLabels } from "@/modules/types"

/** The same row geometry while the first read has no data: a question, one line and the two commands. */
const ASKS_PLACEHOLDER: ReadonlyArray<PublicAskView> = [1, 2, 3].map((n) => ({
    id: `placeholder-${n}`,
    question: "-",
    line: "-",
    answerHref: "",
    isPending: false,
}))

/** What the side pane of the questions draws and calls. */
interface PublicAsksAsideProps {
    readonly asks: DataSlot<ReadonlyArray<PublicAskView>>
    readonly labels: SlotLabels
    readonly copy: PublicBrainCopy
    /** The owner may answer or set aside; a reader sees the questions only. */
    readonly canWrite: boolean
    /** The page's first read has no data yet: the head and the rows draw their skeleton at once. */
    readonly isWaiting: boolean
    readonly onSkip: (id: string) => void
    readonly onRetry: () => void
}

/** One question as a row: the words customers used, how often and when, and the two ways to answer it. */
const rowOf = (ask: PublicAskView, props: PublicAsksAsideProps): ListRowData => ({
    id: ask.id,
    title: ask.question,
    description: ask.line,
    ...(props.canWrite
        ? {
              detail: (
                  <Cluster gap="inline">
                      <Button intent="neutral" size="sm" href={ask.answerHref}>
                          {props.copy.answerLabel}
                      </Button>
                      <Button
                          intent="alternative"
                          size="sm"
                          isPending={ask.isPending}
                          onPress={() => props.onSkip(ask.id)}
                      >
                          {props.copy.skipLabel}
                      </Button>
                  </Cluster>
              ),
          }
        : {}),
})

/** The count under the title once the questions are known. */
const countOf = (asks: PublicAsksAsideProps["asks"], copy: PublicBrainCopy): string | undefined =>
    "items" in asks ? copy.asideCount(asks.items.length) : undefined

/**
 * The side pane of the public documents: the customer questions nobody answered yet, each with "add an answer" and "set aside", and the
 * line (under the rows) that says what the chatbot does meanwhile. It is a column from the wide width and a drawer below it.
 */
export const PublicAsksAside = (props: PublicAsksAsideProps) => {
    const count = countOf(props.asks, props.copy)
    return (
        <>
            <PaneHead
                title={props.copy.asideTitle}
                headingLevel={2}
                {...(count === undefined ? {} : { description: count })}
                isLoading={props.isWaiting}
            />
            <PaneSection gap="section" isLoading={props.isWaiting}>
                <SlotView
                    slot={props.asks}
                    placeholder={ASKS_PLACEHOLDER}
                    labels={props.labels}
                    errorDescription={props.copy.asideError}
                    emptyDescription={props.copy.asideEmpty}
                    errorLayout="band"
                    onRetry={props.onRetry}
                    render={(asks, isLoading) => (
                        <Section
                            kind="list"
                            ariaLabel={props.copy.asideTitle}
                            isLoading={isLoading}
                            items={asks.map((ask) => rowOf(ask, props))}
                            empty={<EmptyNotice message={props.copy.asideEmpty} />}
                        />
                    )}
                />
                <Text size="xs" tone="muted" isLoading={props.isWaiting}>
                    {props.copy.asideHint}
                </Text>
            </PaneSection>
        </>
    )
}
