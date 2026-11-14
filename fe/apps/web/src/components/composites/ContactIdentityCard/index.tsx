import { SurfaceCard, type DropdownMenuEntry, type FooterZone, type ListRowData } from "@starci/grammar/common"
import { ContactSuggestionsList } from "@/components/composites/ContactSuggestionsList"
import type { ContactDetailView, ContactIdentityView, ContactsPanesCopy } from "@/modules/types"

/** What the identity card draws and does. */
interface ContactIdentityCardProps {
    readonly copy: Pick<
        ContactsPanesCopy,
        | "editLabel"
        | "rowMenuLabel"
        | "unlinkLabel"
        | "linkIdentityLabel"
        | "mergeLabel"
        | "deleteLabel"
        | "suggestionsTitle"
        | "suggestionViewLabel"
        | "suggestionMergeLabel"
        | "suggestionDismissLabel"
    >
    readonly person: Pick<
        ContactDetailView,
        "id" | "name" | "initial" | "line" | "identities" | "canDelete" | "suggestions"
    >
    readonly isLoading: boolean
    readonly on: {
        readonly edit: () => void
        readonly link: () => void
        readonly merge: () => void
        readonly unlink: (identityId: string) => void
        readonly remove: () => void
        /** Opens a person the card suggests as the same one. */
        readonly open: (contactId: string) => void
        readonly mergeSuggestion: (contactId: string) => void
        readonly dismissSuggestion: (contactId: string) => void
    }
}

/** The commands behind the person's row menu: merge into another person, and, for an owner, delete. */
const personMenuOf = (props: ContactIdentityCardProps): ReadonlyArray<DropdownMenuEntry> => [
    {
        kind: "section",
        id: "person",
        items: [
            { id: "merge", label: props.copy.mergeLabel, onAction: props.on.merge },
            ...(props.person.canDelete
                ? [{ id: "delete", label: props.copy.deleteLabel, tone: "danger" as const, onAction: props.on.remove }]
                : []),
        ],
    },
]

/** The person as the first row: the mark, the name, the phone and the mail, and the one command that edits them. */
const personRowOf = (props: ContactIdentityCardProps): ListRowData => ({
    id: "person",
    title: props.person.name,
    ...(props.person.line === "" ? {} : { description: props.person.line }),
    leading: { avatar: { name: props.person.initial, seed: props.person.id }, size: "md" },
    action: { label: props.copy.editLabel, intent: "neutral", press: props.on.edit },
    actionPlacement: "end",
    menu: { label: props.copy.rowMenuLabel, entries: personMenuOf(props) },
})

/** One identity as a row: where it is, its value and how it is proven, and at its end the reason it is on this person. */
const identityRowOf = (identity: ContactIdentityView, props: ContactIdentityCardProps): ListRowData => ({
    id: identity.id,
    title: identity.title,
    description: `${identity.value} · ${identity.proof}`,
    leading:
        identity.logo === null
            ? { avatar: { name: identity.title }, size: "sm" }
            : { avatar: { name: identity.title, src: identity.logo, shape: "square" }, size: "sm" },
    ...(identity.reason === null ? {} : { meta: { text: identity.reason } }),
    menu: {
        label: props.copy.rowMenuLabel,
        entries: [
            {
                kind: "section",
                id: "identity",
                items: [
                    {
                        id: "unlink",
                        label: props.copy.unlinkLabel,
                        tone: "danger" as const,
                        onAction: () => props.on.unlink(identity.id),
                    },
                ],
            },
        ],
    },
})

/** The bands under the rows: the command that links one more way, then, when there is one, the list of people who may be the same. */
const footersOf = (props: ContactIdentityCardProps): ReadonlyArray<FooterZone> => [
    { kind: "more", label: props.copy.linkIdentityLabel, press: props.on.link },
    ...(props.person.suggestions.length === 0
        ? []
        : [
              {
                  kind: "custom" as const,
                  children: (
                      <ContactSuggestionsList
                          copy={props.copy}
                          suggestions={props.person.suggestions}
                          isLoading={props.isLoading}
                          onOpen={props.on.open}
                          onMerge={props.on.mergeSuggestion}
                          onDismiss={props.on.dismissSuggestion}
                      />
                  ),
              },
          ]),
]

/**
 * Who the person is as one card: the person with the command that edits them, then one row per way to reach them (its channel, its
 * value, how it is proven) with the reason it joined this person at its end, under the rows the command that links one more, and
 * under it the bordered list of people who may be the same (a suggestion, never applied by itself).
 */
export const ContactIdentityCard = (props: ContactIdentityCardProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.person.name}
        isLoading={props.isLoading}
        items={[personRowOf(props), ...props.person.identities.map((identity) => identityRowOf(identity, props))]}
        empty={null}
        footers={footersOf(props)}
    />
)
