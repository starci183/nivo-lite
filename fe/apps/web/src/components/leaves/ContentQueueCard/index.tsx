import { Button, ListRow, SurfaceCard, Text } from "@starci/grammar/common"
import type { ContentT, PostView, QuoteView } from "@/modules/types"
import { ACTIONS_CLASS_NAME, QUOTE_CLASS_NAME } from "./classNames"

/** Props of {@link ContentQueueCard}. */
interface ContentQueueCardProps {
    /** The post waiting for approval. */
    readonly post: PostView
    /** The text of each channel as it will be posted. */
    readonly quotes: ReadonlyArray<QuoteView>
    /** Whether a decision is open for the post. */
    readonly hasDecision: boolean
    readonly canDecide: boolean
    /** True while a decision on any post is recorded. */
    readonly isPending: boolean
    /** Which decision is being recorded for this post, or null. */
    readonly busy: "approved" | "rejected" | null
    /** The outcome message of the last decision on this post. */
    readonly note: { readonly tone: "ok" | "error"; readonly text: string } | undefined
    readonly t: ContentT
    readonly onDecide: (id: string, decision: "approved" | "rejected") => void
    readonly onOpen: (id: string) => void
}

/** One post waiting for the owner: the text of each channel as it will be posted, and open, refuse or approve. */
export const ContentQueueCard = (props: ContentQueueCardProps) => {
    const { post, t } = props
    return (
        <ListRow
            title={post.title}
            description={post.when}
            actions={
                <div className={ACTIONS_CLASS_NAME}>
                    <Button intent="neutral" size="sm" onPress={() => props.onOpen(post.id)}>
                        {t("queueOpen")}
                    </Button>
                    {props.canDecide && props.hasDecision ? (
                        <>
                            <Button
                                intent="destructive"
                                step="entry"
                                size="sm"
                                isPending={props.isPending && props.busy === "rejected"}
                                isDisabled={props.isPending}
                                onPress={() => props.onDecide(post.id, "rejected")}
                            >
                                {t("reject")}
                            </Button>
                            <Button
                                intent="alternative"
                                size="sm"
                                isPending={props.isPending && props.busy === "approved"}
                                isDisabled={props.isPending}
                                onPress={() => props.onDecide(post.id, "approved")}
                            >
                                {t("approve")}
                            </Button>
                        </>
                    ) : null}
                </div>
            }
        >
            {props.quotes.map((quote) => (
                <SurfaceCard key={quote.channel} ariaLabel={quote.label}>
                    <div className={QUOTE_CLASS_NAME}>
                        <Text size="xs" tone="muted" weight="medium">
                            {quote.label}
                        </Text>
                        <Text as="p" size="sm">
                            {quote.text}
                        </Text>
                    </div>
                </SurfaceCard>
            ))}
            {props.hasDecision ? null : (
                <Text size="sm" tone="muted">
                    {t("queueNoDecision")}
                </Text>
            )}
            {props.note ? (
                <Text size="sm" live={props.note.tone === "error" ? "assertive" : "polite"}>
                    {props.note.text}
                </Text>
            ) : null}
        </ListRow>
    )
}
