import {
    type BadgeTone,
    Badge,
    Button,
    Cluster,
    DescriptionList,
    Disclosure,
    DropdownMenu,
    Heading,
    Icon,
    IconButton,
    Link,
    Stack,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** One command of a card: a destination or a command, named by the id the caller answers to. */
interface CardAction<Id extends string> {
    readonly id: Id
    readonly label: string
    readonly href: string | null
}

/** One finding as the card draws it, already worded. */
interface CardView<Id extends string> {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
    readonly meta: string | null
    readonly evidenceTitle: string
    readonly evidence: ReadonlyArray<{ readonly id: string; readonly label: string; readonly description?: string }>
    readonly sources: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href: string }>
    /** The two commands drawn in the open, and the ones the menu holds. */
    readonly open: ReadonlyArray<CardAction<Id>>
    readonly menu: ReadonlyArray<CardAction<Id>>
}

/** The glyph a command wears when it has one: the document to bring, and the draft NIVO writes. */
const ACTION_GLYPH: Readonly<Partial<Record<string, IconName>>> = { upload: "upload", askDraft: "talents" }

/** The evidence of a finding, folded: each piece and the documents it comes from. */
const Evidence = (props: Pick<CardView<string>, "evidenceTitle" | "evidence" | "sources">) => (
    <Disclosure
        kind="quiet"
        chevron="start"
        title={props.evidenceTitle}
        headingLevel={4}
        body={
            <Stack gap="row">
                <DescriptionList
                    layout="stacked"
                    items={props.evidence.map((item) => ({
                        id: item.id,
                        term: item.label,
                        description: item.description ?? "",
                    }))}
                />
                <Cluster gap="row">
                    {props.sources.map((source) => (
                        <Link key={source.id} href={source.href}>
                            {source.label}
                        </Link>
                    ))}
                </Cluster>
            </Stack>
        }
    />
)

/** What one card of a finding says and calls. */
interface CommandsProps<Id extends string> {
    readonly row: CardView<Id>
    readonly optionsLabel: string
    readonly onAction: (findingId: string, action: Id) => void
}

/** What one card of a finding says and calls. */
interface DossierFindingCardProps<Id extends string> {
    readonly row: CardView<Id>
    readonly isLoading: boolean
    readonly optionsLabel: string
    readonly onAction: (findingId: string, action: Id) => void
}

/** The commands of a finding: the two most wanted in view, the rest in its menu. */
const Commands = <Id extends string>(props: CommandsProps<Id>) => {
    const { open, menu } = props.row
    const commands = menu.filter((action) => action.href === null)
    if (open.length === 0 && commands.length === 0) return null
    return (
        <Cluster gap="inline">
            {open.map((action) => {
                const glyph = ACTION_GLYPH[action.id]
                const start =
                    glyph === undefined
                        ? {}
                        : { startContent: <Icon source={nivoIconSource(glyph, "leading")} usage="leading" /> }
                return action.href === null ? (
                    <Button
                        key={action.id}
                        size="sm"
                        intent="neutral"
                        {...start}
                        onPress={() => props.onAction(props.row.id, action.id)}
                    >
                        {action.label}
                    </Button>
                ) : (
                    <Button key={action.id} size="sm" intent="neutral" {...start} href={action.href}>
                        {action.label}
                    </Button>
                )
            })}
            {commands.length === 0 ? null : (
                <DropdownMenu
                    placement="bottom end"
                    entries={commands.map((action) => ({
                        id: action.id,
                        label: action.label,
                        onAction: () => props.onAction(props.row.id, action.id),
                    }))}
                    trigger={
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("more", "leading")}
                            label={props.optionsLabel}
                        />
                    }
                />
            )}
        </Cluster>
    )
}

/** One finding: how serious and what kind, what it says, the evidence it rests on and what can be done. */
export const DossierFindingCard = <Id extends string>(props: DossierFindingCardProps<Id>) => (
    <Stack gap="row">
        <Cluster gap="inline">
            {props.row.badges.map((badge) => (
                <Badge key={badge.id} tone={badge.tone}>
                    {badge.label}
                </Badge>
            ))}
        </Cluster>
        <Heading level={3} isLoading={props.isLoading}>
            {props.row.title}
        </Heading>
        <Text size="sm" tone="muted" isLoading={props.isLoading}>
            {props.row.detail}
        </Text>
        {props.row.meta === null ? null : (
            <Text size="xs" tone="muted">
                {props.row.meta}
            </Text>
        )}
        {props.row.evidence.length === 0 ? null : <Evidence {...props.row} />}
        <Commands {...props} />
    </Stack>
)
