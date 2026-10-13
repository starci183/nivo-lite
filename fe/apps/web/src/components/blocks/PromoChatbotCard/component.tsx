import { Button, CloseButton, Divider, SurfaceCard, Text } from "@starci/grammar/common"
import { PROMO_ACTIONS, PROMO_BLOCK, PROMO_COPY, PROMO_ROW } from "./classNames"

/** Copy and handlers of the Chatbot promo. */
export interface PromoChatbotCardBaseProps {
    readonly props: {
        /** `row` is the quiet row at the top of the leads list; `card` is the system-style card of the Office conversation. */
        readonly variant: "row" | "card"
        readonly tag: string | null
        readonly title: string
        readonly body: string | null
        readonly actionLabel: string
        readonly actionHref: string
        readonly dismissLabel: string
    }
    readonly on: { readonly dismiss: () => void }
}

/** Draws the Chatbot promo in its row or card shape: copy, one quiet action and a dismiss control. */
export const PromoChatbotCardBase = (props: PromoChatbotCardBaseProps) => {
    const content = (
        <div className={PROMO_ROW}>
            <div className={PROMO_COPY}>
                {props.props.tag === null ? null : <Text size="xs">{props.props.tag}</Text>}
                <Text weight="medium">{props.props.title}</Text>
                {props.props.body === null ? null : (
                    <Text size="sm" tone="muted">
                        {props.props.body}
                    </Text>
                )}
            </div>
            <div className={PROMO_ACTIONS}>
                <Button variant="outline" size="sm" href={props.props.actionHref}>
                    {props.props.actionLabel}
                </Button>
                <CloseButton label={props.props.dismissLabel} size="sm" onPress={props.on.dismiss} />
            </div>
        </div>
    )
    if (props.props.variant === "card") {
        return (
            <div role="note">
                <SurfaceCard depth="nested">{content}</SurfaceCard>
            </div>
        )
    }
    return (
        <div className={PROMO_BLOCK} role="note">
            {content}
            <Divider semantics="presentation" />
        </div>
    )
}
