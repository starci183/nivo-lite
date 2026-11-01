import { Badge, Button, Quote, SurfaceCard, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import type { FindingCardActionView, FindingCardView } from "@/hooks/brain"
import {
    CARDS_CLASS_NAME,
    CARD_ACTIONS_CLASS_NAME,
    CARD_BODY_CLASS_NAME,
    CARD_HEAD_CLASS_NAME,
    QUOTES_CLASS_NAME,
} from "./classNames"

export type { FindingCardActionView, FindingCardView } from "@/hooks/brain"

/** What the cards say and call. */
interface FindingCardsProps {
    /** Names the list of cards. */
    readonly label: string
    /** The cards are a placeholder: the list draws as inert geometry. */
    readonly isSkeleton: boolean
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
        <Button size="sm" intent={props.action.intent} onPress={() => props.onAction(props.card.id, props.action)}>
            {props.action.label}
        </Button>
    ) : (
        <Button size="sm" intent={props.action.intent} href={props.action.href}>
            {props.action.label}
        </Button>
    )

/** One finding as a card: what kind it is, the question, the words of the documents that disagree, and what answers it. */
const FindingCard = (props: FindingCardProps) => (
    <SurfaceCard label={props.card.title} headingLevel={3}>
        <div className={CARD_BODY_CLASS_NAME}>
            <div className={CARD_HEAD_CLASS_NAME}>
                <Badge tone={props.card.kind.tone}>{props.card.kind.label}</Badge>
                {props.card.badges.map((badge) => (
                    <Badge key={badge.id} tone={badge.tone}>
                        {badge.label}
                    </Badge>
                ))}
                {props.card.dossier === null ? null : (
                    <Text tone="muted">
                        <TextAction href={props.card.dossier.href}>{props.card.dossier.label}</TextAction>
                    </Text>
                )}
            </div>
            <Text>{props.card.detail}</Text>
            {props.card.meta === null ? null : <Text tone="muted">{props.card.meta}</Text>}
            {props.card.quotes.length === 0 ? null : (
                <div className={QUOTES_CLASS_NAME}>
                    {props.card.quotes.map((quote) => (
                        <Quote
                            key={quote.id}
                            source={quote.source}
                            {...(quote.byline === undefined ? {} : { byline: quote.byline })}
                        >
                            {quote.text}
                        </Quote>
                    ))}
                </div>
            )}
            {props.card.actions.length === 0 ? null : (
                <div className={CARD_ACTIONS_CLASS_NAME}>
                    {props.card.actions.map((action) => (
                        <CardAction key={action.id} card={props.card} action={action} onAction={props.onAction} />
                    ))}
                </div>
            )}
        </div>
    </SurfaceCard>
)

/** The findings of the queue, one card each, worst first as they arrive. */
export const FindingCards = (props: FindingCardsProps) => (
    <div className={CARDS_CLASS_NAME}>
        {props.isSkeleton ? <SurfaceListCard ariaLabel={props.label} isLoading /> : null}
        {props.cards.map((card) => (
            <FindingCard key={card.id} card={card} onAction={props.onAction} />
        ))}
    </div>
)
