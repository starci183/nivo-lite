import { Alert, Button, Cluster, Grid, Heading, Quote, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { QueueActionView, QueueDetailView, QueueQuoteView, QueueTileView } from "@/modules/types"

/** What the opened item draws. */
interface QueueDetailProps {
    readonly detail: QueueDetailView
    /** The first read has no data yet: the words keep their boxes, the values draw as geometry. */
    readonly isLoading: boolean
    readonly onAction: (actionId: string, partId?: string) => void
}

/** What one command of an item draws. */
interface CommandProps {
    readonly action: QueueActionView
    readonly onAction: QueueDetailProps["onAction"]
}

/** One command of an item: a destination or a command; the commands that answer it sit side by side, none of them filled. */
const Command = (props: CommandProps) =>
    props.action.href === null ? (
        <Button
            intent={props.action.intent}
            isPending={props.action.isPending}
            onPress={() => props.onAction(props.action.id, props.action.partId)}
        >
            {props.action.label}
        </Button>
    ) : (
        <Button intent={props.action.intent} href={props.action.href}>
            {props.action.label}
        </Button>
    )

/** What one value tile draws. */
interface TileProps {
    readonly tile: QueueTileView
    readonly onAction: QueueDetailProps["onAction"]
    readonly isLoading: boolean
}

/** One value laid beside the others, with the commands that decide it. */
const Tile = (props: TileProps) => (
    <SurfaceCard ariaLabel={props.tile.title} isLoading={props.isLoading} isHighlight={props.tile.isHighlighted}>
        <Stack gap="row">
            {props.tile.label === null ? null : (
                <Text size="xs" tone="muted">
                    {props.tile.label}
                </Text>
            )}
            <Text isStrong>{props.tile.title}</Text>
            {props.tile.lines.map((line) => (
                <Text key={line} size="xs" tone="muted">
                    {line}
                </Text>
            ))}
            {props.tile.actions.length === 0 ? null : (
                <Cluster gap="inline" justify="end">
                    {props.tile.actions.map((action) => (
                        <Command key={action.id} action={action} onAction={props.onAction} />
                    ))}
                </Cluster>
            )}
        </Stack>
    </SurfaceCard>
)

/** What the words behind an item draw. */
interface QuotesProps {
    readonly quotes: ReadonlyArray<QueueQuoteView>
    readonly isLoading: boolean
}

/** What one quote draws. */
interface OneQuoteProps {
    readonly quote: QueueQuoteView
    readonly isLoading: boolean
}

/** One quote: the words, the document they come from and where in it. */
const OneQuote = (props: OneQuoteProps) => (
    <Quote
        source={props.quote.source}
        text={props.quote.text}
        {...(props.quote.byline === undefined ? {} : { byline: props.quote.byline })}
        isLoading={props.isLoading}
    />
)

/** The words behind an item: one quote alone, two side by side (the documents it is between). */
const Quotes = (props: QuotesProps) => {
    const [first, second] = props.quotes
    if (first === undefined) return null
    if (second === undefined) return <OneQuote quote={first} isLoading={props.isLoading} />
    return (
        <Grid
            kind="pair"
            leading={<OneQuote quote={first} isLoading={props.isLoading} />}
            trailing={<OneQuote quote={second} isLoading={props.isLoading} />}
        />
    )
}

/**
 * The opened item of the queue, under its head: the question it asks, the words behind it, the two documents or values it is
 * between side by side, then the commands that answer it, end-aligned. While the read waits the same boxes draw as geometry.
 */
export const QueueDetail = (props: QueueDetailProps) => {
    const detail = props.detail
    return (
        <Stack gap="section">
            {detail.heading === null ? null : (
                <Heading level={2} isLoading={props.isLoading}>
                    {detail.heading}
                </Heading>
            )}
            {detail.body === null ? null : <Text isLoading={props.isLoading}>{detail.body}</Text>}
            {detail.lines.map((line) => (
                <Text key={line} tone="muted" isLoading={props.isLoading}>
                    {line}
                </Text>
            ))}
            <Quotes quotes={detail.quotes} isLoading={props.isLoading} />
            {detail.tiles.map((tile) => (
                <Tile key={tile.id} tile={tile} onAction={props.onAction} isLoading={props.isLoading} />
            ))}
            {detail.notice === null ? null : (
                <Alert
                    title={detail.notice.title}
                    {...(detail.notice.description === "" ? {} : { description: detail.notice.description })}
                    tone="informative"
                />
            )}
            {detail.actions.length === 0 ? null : (
                <Cluster gap="inline" justify="end">
                    {detail.actions.map((action) => (
                        <Command key={action.id} action={action} onAction={props.onAction} />
                    ))}
                </Cluster>
            )}
            {detail.footnote === null ? null : (
                <Text size="xs" tone="muted">
                    {detail.footnote}
                </Text>
            )}
        </Stack>
    )
}
