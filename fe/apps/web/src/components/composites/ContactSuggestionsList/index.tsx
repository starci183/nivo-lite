import { Section, type SectionRow } from "@starci/grammar/common"
import type { ContactSuggestionView, ContactsPanesCopy } from "@/modules/types"

/** What the suggestions list draws and does. */
interface ContactSuggestionsListProps {
    readonly copy: Pick<
        ContactsPanesCopy,
        "suggestionsTitle" | "suggestionViewLabel" | "suggestionMergeLabel" | "suggestionDismissLabel" | "rowMenuLabel"
    >
    readonly suggestions: ReadonlyArray<ContactSuggestionView>
    readonly isLoading: boolean
    readonly onOpen: (contactId: string) => void
    readonly onMerge: (contactId: string) => void
    readonly onDismiss: (contactId: string) => void
}

/** One suggested person as a row: why they may be the same, the one command that opens them, and a menu to merge or dismiss. */
const rowOf = (suggestion: ContactSuggestionView, props: ContactSuggestionsListProps): SectionRow => ({
    id: suggestion.contactId,
    title: suggestion.name,
    description: suggestion.why,
    leading: { avatar: { name: suggestion.name, seed: suggestion.contactId }, size: "sm" },
    action: {
        label: props.copy.suggestionViewLabel,
        intent: "neutral",
        press: () => props.onOpen(suggestion.contactId),
    },
    actionPlacement: "end",
    menu: {
        label: props.copy.rowMenuLabel,
        entries: [
            {
                kind: "section",
                id: "suggestion",
                items: [
                    {
                        id: "merge",
                        label: props.copy.suggestionMergeLabel,
                        onAction: () => props.onMerge(suggestion.contactId),
                    },
                    {
                        id: "dismiss",
                        label: props.copy.suggestionDismissLabel,
                        onAction: () => props.onDismiss(suggestion.contactId),
                    },
                ],
            },
        ],
    },
})

/**
 * The people who may be the same as this one, each with the reason, as a bordered list inside the card of the person (a group named
 * by its sublabel, never a card of its own): a suggestion is never applied by itself, a person views it, merges it or dismisses it.
 * Nothing is drawn when there is no suggestion.
 */
export const ContactSuggestionsList = (props: ContactSuggestionsListProps) =>
    props.suggestions.length === 0 ? null : (
        <Section
            kind="list"
            sublabel={props.copy.suggestionsTitle}
            isLoading={props.isLoading}
            items={props.suggestions.map((suggestion) => rowOf(suggestion, props))}
            empty={null}
        />
    )
