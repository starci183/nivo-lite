import {
    Alert,
    Badge,
    Button,
    EmptyNotice,
    ListItem,
    Region,
    SectionHeader,
    SurfaceListCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import {
    FEED_BADGES_CLASS,
    FEED_FOOT_CLASS,
    FEED_HEAD_CLASS,
    FEED_ITEM_CLASS,
    FEED_META_CLASS,
    FEED_SECTION_CLASS,
    FEED_TITLE_CLASS,
} from "./classNames"

/** One received input with every word already in the reader's language. */
export interface InboxFeedRow {
    readonly id: string
    readonly source: string
    readonly kind: string
    readonly ago: string
    readonly status: { readonly label: string; readonly tone: "neutral" | "success" | "warning" | "danger" }
    readonly body: string
    /** Sender, contact, amount, reference and event lines. */
    readonly meta: ReadonlyArray<{ readonly key: string; readonly text: string; readonly strong: boolean }>
    readonly duplicates: string | null
    readonly lead: { readonly href: string; readonly label: string } | null
    readonly office: { readonly href: string; readonly label: string } | null
}

/** Props for {@link InboxFeedBase}. */
export interface InboxFeedBaseProps {
    readonly props: {
        readonly ariaLabel: string
        readonly title: string
        readonly description: string
        readonly refreshLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly isLoading: boolean
        readonly error?: string | undefined
        readonly errorTitle: string
        readonly rows: ReadonlyArray<InboxFeedRow>
    }
    readonly on: { readonly refresh: () => void }
}

/** Feed of received inputs, newest first, each with where it stands. */
export const InboxFeedBase = (props: InboxFeedBaseProps) => {
    const view = props.props
    return (
        <Region className={FEED_SECTION_CLASS} label={view.ariaLabel}>
            <SectionHeader
                level={2}
                title={view.title}
                description={view.description}
                action={
                    <Button variant="secondary" isSkeleton={view.isLoading} onPress={props.on.refresh}>
                        {view.refreshLabel}
                    </Button>
                }
            />
            {view.error ? <Alert title={view.errorTitle} description={view.error} tone="negative" /> : null}
            <SurfaceListCard
                ariaLabel={view.title}
                isLoading={view.isLoading}
                empty={<EmptyNotice message={view.emptyTitle} description={view.emptyBody} />}
            >
                {view.rows.map((row) => (
                    <ListItem key={row.id} className={FEED_ITEM_CLASS}>
                        <div className={FEED_HEAD_CLASS}>
                            <div className={FEED_TITLE_CLASS}>
                                <Text weight="semibold">{row.source}</Text>
                                <Text tone="muted" size="sm">
                                    {row.kind}
                                </Text>
                                <Text tone="muted" size="sm">
                                    {row.ago}
                                </Text>
                            </div>
                            <div className={FEED_BADGES_CLASS}>
                                <Badge tone={row.status.tone}>{row.status.label}</Badge>
                            </div>
                        </div>
                        {row.body === "" ? null : <Text overflow="clamp-2">{row.body}</Text>}
                        <div className={FEED_META_CLASS}>
                            {row.meta.map((line) => (
                                <Text
                                    key={line.key}
                                    size="sm"
                                    {...(line.strong ? {} : { tone: "muted" as const })}
                                    {...(line.strong ? { weight: "medium" as const } : {})}
                                >
                                    {line.text}
                                </Text>
                            ))}
                        </div>
                        {row.duplicates === null && row.lead === null && row.office === null ? null : (
                            <div className={FEED_FOOT_CLASS}>
                                {row.duplicates === null ? null : (
                                    <Text size="sm" tone="muted">
                                        {row.duplicates}
                                    </Text>
                                )}
                                {row.lead === null ? null : (
                                    <TextAction href={row.lead.href}>{row.lead.label}</TextAction>
                                )}
                                {row.office === null ? null : (
                                    <TextAction href={row.office.href}>{row.office.label}</TextAction>
                                )}
                            </div>
                        )}
                    </ListItem>
                ))}
            </SurfaceListCard>
        </Region>
    )
}
