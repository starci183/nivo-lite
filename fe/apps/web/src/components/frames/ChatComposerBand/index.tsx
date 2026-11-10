import type { ReactNode } from "react"
import { Button, Cluster, PaneSection } from "@starci/grammar/common"

/** One start of a message the composer offers in one press. */
interface Suggestion {
    readonly id: string
    readonly label: string
}

/** The composer band: the starts offered above it and the composer itself. */
interface ChatComposerBandProps {
    readonly isWaiting: boolean
    readonly suggestions: ReadonlyArray<Suggestion>
    readonly onSuggest: (id: string) => void
    readonly children: ReactNode
}

/** The composer of every chat pane, pinned under the thread: the separator, a row of small suggestion buttons, then the field with its send. */
export const ChatComposerBand = (props: ChatComposerBandProps) => (
    <PaneSection as="footer" isLoading={props.isWaiting} gap="row">
        {props.suggestions.length === 0 ? null : (
            <Cluster gap="inline">
                {props.suggestions.map((suggestion) => (
                    <Button
                        key={suggestion.id}
                        intent="neutral"
                        size="sm"
                        onPress={() => props.onSuggest(suggestion.id)}
                    >
                        {suggestion.label}
                    </Button>
                ))}
            </Cluster>
        )}
        {props.children}
    </PaneSection>
)
