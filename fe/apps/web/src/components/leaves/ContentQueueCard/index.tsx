import { Button, Cluster, Quote, Stack, Text } from "@starci/grammar/common"
import type { PostView, QuoteView, ContentViews } from "@/modules/types"

/** Props of {@link ContentQueueCard}: the body of one waiting post inside its row. */
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
    readonly copy: ContentViews["workbenchCopy"]
    readonly onDecide: (id: string, decision: "approved" | "rejected") => void
    readonly onOpen: (id: string) => void
    /** The row is a placeholder while the read is in flight: the same tree draws as a skeleton. */
    readonly isLoading?: boolean
}

/** One post waiting for the owner: the text of each channel as it will be posted, as quotes inside the row's detail. */
export const ContentQueueCard = (props: ContentQueueCardProps) => (
    <Stack gap="row">
        {props.quotes.map((quote) => (
            <Quote key={quote.channel} source={quote.label} text={quote.text} isLoading={props.isLoading ?? false} />
        ))}
        <Cluster gap="inline">
            <Button
                isLoading={props.isLoading ?? false}
                intent="neutral"
                size="sm"
                onPress={() => props.onOpen(props.post.id)}
            >
                {props.copy.queueOpen}
            </Button>
            {props.canDecide && props.hasDecision ? (
                <>
                    <Button
                        isLoading={props.isLoading ?? false}
                        intent="destructive"
                        step="entry"
                        size="sm"
                        isPending={props.isPending && props.busy === "rejected"}
                        isDisabled={props.isPending}
                        onPress={() => props.onDecide(props.post.id, "rejected")}
                    >
                        {props.copy.reject}
                    </Button>
                    <Button
                        isLoading={props.isLoading ?? false}
                        intent="alternative"
                        size="sm"
                        isPending={props.isPending && props.busy === "approved"}
                        isDisabled={props.isPending}
                        onPress={() => props.onDecide(props.post.id, "approved")}
                    >
                        {props.copy.approve}
                    </Button>
                </>
            ) : null}
        </Cluster>
        {props.hasDecision ? null : (
            <Text isLoading={props.isLoading ?? false} size="sm" tone="muted">
                {props.copy.queueNoDecision}
            </Text>
        )}
        {props.note ? (
            <Text
                isLoading={props.isLoading ?? false}
                size="sm"
                live={props.note.tone === "error" ? "assertive" : "polite"}
            >
                {props.note.text}
            </Text>
        ) : null}
    </Stack>
)
