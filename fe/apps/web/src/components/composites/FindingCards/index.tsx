import { Badge, Button, Cluster, EmptyNotice, Quote, Section, Stack, Text, Link } from "@starci/grammar/common"
import type { FindingCardActionView, FindingCardView } from "@/hooks/brain"
import type { ListRowData } from "@starci/grammar/common"

export type { FindingCardActionView, FindingCardView } from "@/hooks/brain"

/** What the cards say and call. */
interface FindingCardsProps {
    /** Names the list of cards. */
    readonly label: string
    /** The cards are a placeholder: the list draws as inert geometry. */
    readonly isLoading: boolean
    readonly cards: ReadonlyArray<FindingCardView>
    readonly onAction: (findingId: string, action: FindingCardActionView) => void
}

/** One card and what its actions call. */
interface FindingCardProps {
    readonly card: FindingCardView
    readonly onAction: FindingCardsProps["onAction"]
}

/** One action of a card and what it calls. */
interface CardActionProps {
    readonly card: FindingCardView
    readonly action: FindingCardActionView
    readonly onAction: FindingCardsProps["onAction"]
}

/** The action of a card: a destination for the upload, a command for the rest. */
const CardAction = (props: CardActionProps) =>
    props.action.href === null ? (
        <Button
            size="sm"
            intent={props.action.intent === "commit" ? "neutral" : props.action.intent}
            onPress={() => props.onAction(props.card.id, props.action)}
        >
            {props.action.label}
        </Button>
    ) : (
        <Button size="sm" intent={props.action.intent} href={props.action.href}>
            {props.action.label}
        </Button>
    )

/** The rich evidence and commands sit in the row's named detail field, without another surface. */
const FindingDetail = (props: FindingCardProps) => (
    <Stack gap="section">
        <Cluster gap="inline">
            {props.card.badges.map((badge) => (
                <Badge key={badge.id} tone={badge.tone}>
                    {badge.label}
                </Badge>
            ))}
            {props.card.dossier === null ? null : (
                <Link href={props.card.dossier.href}>{props.card.dossier.label}</Link>
            )}
        </Cluster>
        <Text>{props.card.detail}</Text>
        {props.card.meta === null ? null : <Text tone="muted">{props.card.meta}</Text>}
        {props.card.quotes.length === 0 ? null : (
            <Cluster gap="row" align="start">
                {props.card.quotes.map((quote) => (
                    <Quote
                        key={quote.id}
                        source={quote.source}
                        text={quote.text}
                        {...(quote.byline === undefined ? {} : { byline: quote.byline })}
                    />
                ))}
            </Cluster>
        )}
        {props.card.actions.length === 0 ? null : (
            <Cluster gap="inline">
                {props.card.actions.map((action) => (
                    <CardAction key={action.id} card={props.card} action={action} onAction={props.onAction} />
                ))}
            </Cluster>
        )}
    </Stack>
)

/** Findings remain one queue; the collection draws its loading and ready rows from the same item data. */
export const FindingCards = (props: FindingCardsProps) => {
    const items: ListRowData[] = props.cards.map((card) => ({
        id: card.id,
        title: card.title,
        badges: [{ label: card.kind.label, tone: card.kind.tone }],
        detail: <FindingDetail card={card} onAction={props.onAction} />,
    }))
    return (
        <Section
            kind="list"
            title={props.label}
            isLoading={props.isLoading === true}
            items={items}
            empty={<EmptyNotice message={props.label} />}
        />
    )
}
