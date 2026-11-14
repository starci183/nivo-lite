import { SurfaceCard, Text, type DropdownMenuEntry, type ListRowData } from "@starci/grammar/common"
import type { ContactDetailView, ContactIdentityView, ContactsPanesCopy } from "@/modules/types"

/** What the identity card draws and does. */
interface ContactIdentityCardProps {
    readonly copy: Pick<
        ContactsPanesCopy,
        "editLabel" | "noWayLine" | "rowMenuLabel" | "unlinkLabel" | "linkIdentityLabel" | "mergeLabel" | "deleteLabel"
    >
    readonly person: Pick<ContactDetailView, "id" | "name" | "initial" | "line" | "identities" | "canDelete">
    readonly isLoading: boolean
    readonly on: {
        readonly edit: () => void
        readonly link: () => void
        readonly merge: () => void
        readonly unlink: (identityId: string) => void
        readonly remove: () => void
    }
}

/** The commands behind the person's row menu: link one more way to reach them, merge into another person, and, for an owner, delete. */
const personMenuOf = (props: ContactIdentityCardProps): ReadonlyArray<DropdownMenuEntry> => [
    {
        kind: "section",
        id: "person",
        items: [
            { id: "link", label: props.copy.linkIdentityLabel, onAction: props.on.link },
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
    description: props.person.line === "" ? props.copy.noWayLine : props.person.line,
    leading: { avatar: { name: props.person.initial, seed: props.person.id }, size: "md" },
    action: { label: props.copy.editLabel, intent: "neutral", press: props.on.edit },
    actionPlacement: "end",
    menu: { label: props.copy.rowMenuLabel, entries: personMenuOf(props) },
})

/** One identity as a row: its channel mark, where it is (a channel the staff hold says by whom, 12 muted), and at its end (muted) why it is linked to this person. */
const identityRowOf = (identity: ContactIdentityView, props: ContactIdentityCardProps): ListRowData => ({
    id: identity.id,
    title: identity.title,
    ...(identity.description === null && identity.hold === null
        ? {}
        : {
              description:
                  identity.hold === null ? (
                      identity.description
                  ) : (
                      <Text as="span" size="xs" tone="muted">
                          {identity.hold}
                      </Text>
                  ),
          }),
    leading:
        identity.logo === null
            ? { avatar: { name: identity.title }, size: "sm" }
            : { avatar: { name: identity.title, src: identity.logo, shape: "square" }, size: "sm" },
    ...(identity.why === null ? {} : { meta: { text: identity.why } }),
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

/**
 * Who the person is as one card: the person with the command that edits them, then one row per way to reach them (its channel mark
 * and account, or the phone or mail) with, at its end, why it is linked. Linking one more way lives in the person's menu.
 */
export const ContactIdentityCard = (props: ContactIdentityCardProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.person.name}
        isLoading={props.isLoading}
        items={[personRowOf(props), ...props.person.identities.map((identity) => identityRowOf(identity, props))]}
        empty={null}
    />
)
