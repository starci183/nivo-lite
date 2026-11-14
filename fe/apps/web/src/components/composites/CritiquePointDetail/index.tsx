import { Button, Cluster, Input, Quote, Section, Stack, Text } from "@starci/grammar/common"
import type {
    CritiqueChoiceView,
    CritiqueCopy,
    CritiqueEditorView,
    CritiquePointView,
    CritiqueQuoteView,
} from "@/modules/types"

/** Props for {@link CritiquePointDetail}. */
interface CritiquePointDetailProps {
    readonly props: {
        readonly point: CritiquePointView
        readonly copy: CritiqueCopy
        /** The small input open under this point; null when none is, or when it belongs to another point. */
        readonly editor: CritiqueEditorView | null
        /** A command runs for this point: its buttons wait. */
        readonly isPending: boolean
        readonly isLoading: boolean
    }
    readonly on: {
        readonly press: (choice: CritiqueChoiceView) => void
        readonly change: (value: string) => void
        readonly send: () => void
        readonly cancel: () => void
        readonly skip: () => void
    }
}

/** What one quoted passage draws: the words verbatim on the quote ground, with where they stand. */
interface QuoteProps {
    readonly quote: CritiqueQuoteView
    readonly isLoading: boolean
}

const QuoteOf = (props: QuoteProps) => (
    <Quote
        text={props.quote.text}
        isLoading={props.isLoading}
        {...(props.quote.source === null ? {} : { source: props.quote.source })}
        {...(props.quote.place === null ? {} : { byline: props.quote.place })}
    />
)

/** What the comparison reads: the point and the words of its list. */
interface CompareProps {
    readonly point: CritiquePointView
    readonly copy: CritiqueCopy
}

/** The comparison of a contradiction: what is in force, then what the document says, a bordered list whose rows are the value with its term and source under it. */
const Compare = (props: CompareProps) => {
    const { point, copy } = props
    if (point.compare === null) return null
    return (
        <Section
            kind="list"
            ariaLabel={copy.compareLabel}
            empty={null}
            items={point.compare.map((row) => ({
                id: row.id,
                title: row.value,
                description: (
                    <Text as="span" size="xs" tone="muted">
                        {row.meta === null ? row.term : `${row.term} · ${row.meta}`}
                    </Text>
                ),
            }))}
        />
    )
}

/** The typed value a choice asks for, under the point: one input and two neutral small buttons. */
const Editor = (props: CritiquePointDetailProps) => {
    const { editor, copy, isPending } = props.props
    if (editor === null) return null
    return (
        <Stack gap="row">
            <Input
                id={`critique-${editor.pointId}`}
                name={`critique-${editor.pointId}`}
                label={editor.label}
                isLabelHidden
                placeholder={editor.hint}
                value={editor.value}
                autoFocus
                onValueChange={props.on.change}
            />
            <Cluster gap="inline">
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={isPending}
                    isDisabled={editor.value.trim() === ""}
                    onPress={props.on.send}
                >
                    {copy.send}
                </Button>
                <Button intent="neutral" size="sm" onPress={props.on.cancel}>
                    {copy.cancel}
                </Button>
            </Cluster>
        </Stack>
    )
}

/**
 * The body of one point of the critic under its title: the doubted words as quotes (or the comparison of what is in force and what the document
 * says), the question, why NIVO doubts it, then the point's choices as neutral small buttons and "skip" last. No button is the page's red one.
 * The text addressed to the AI is a quote like any other and has "skip" alone.
 */
export const CritiquePointDetail = (props: CritiquePointDetailProps) => {
    const { point, copy, isPending, isLoading } = props.props
    return (
        <Stack gap="row">
            {point.quotes.map((quote) => (
                <QuoteOf key={quote.id} quote={quote} isLoading={isLoading} />
            ))}
            <Compare point={point} copy={copy} />
            <Stack gap="identity">
                {point.question === "" ? null : <Text>{point.question}</Text>}
                {point.why === "" ? null : (
                    <Text size="xs" tone="muted">
                        {point.why}
                    </Text>
                )}
            </Stack>
            <Editor {...props} />
            <Cluster gap="inline">
                {point.choices.map((choice) => (
                    <Button
                        key={choice.id}
                        intent="neutral"
                        size="sm"
                        isDisabled={isPending}
                        onPress={() => props.on.press(choice)}
                    >
                        {choice.label}
                    </Button>
                ))}
                <Button intent="neutral" size="sm" isDisabled={isPending} onPress={props.on.skip}>
                    {copy.skip}
                </Button>
            </Cluster>
        </Stack>
    )
}
