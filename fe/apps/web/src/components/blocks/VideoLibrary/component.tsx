import {
    Alert,
    Badge,
    Button,
    EmptyNotice,
    Image,
    List,
    ListItem,
    SectionHeader,
    SurfaceCard,
    Text,
    type BadgeTone,
} from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"
import { LIBRARY_CARD, LIBRARY_CELL, LIBRARY_COPY, LIBRARY_GRID, LIBRARY_ROW, LIBRARY_STACK } from "./classNames"

/** One video of the library. */
export interface VideoLibraryEntry {
    readonly id: string
    readonly title: string
    readonly posterUrl: string | null
    readonly noPoster: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly goalLabel: string
    readonly aspectLabel: string
    readonly facts: string
    readonly href: string
    readonly archiveDisabled: boolean
}

/** Copy, state and handlers of the library. */
export interface VideoLibraryBaseProps {
    readonly props: {
        readonly title: string
        readonly meta: string
        readonly entries: ReadonlyArray<VideoLibraryEntry>
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly newLabel: string
        readonly openLabel: string
        readonly duplicateLabel: string
        readonly archiveLabel: string
        readonly viewOnly: string | null
        readonly error: string | null
        readonly dismissLabel: string
        readonly canEdit: boolean
        readonly busy: boolean
    }
    readonly on: {
        readonly create: () => void
        readonly duplicate: (id: string) => void
        readonly archive: (id: string) => void
        readonly dismissError: () => void
    }
}

const emptyOf = (props: VideoLibraryBaseProps["props"], create: () => void) => (
    <SurfaceCard ariaLabel={props.emptyTitle}>
        <EmptyNotice
            message={props.emptyTitle}
            description={props.emptyBody}
            {...(props.canEdit ? { actionLabel: props.newLabel, onAction: create } : {})}
        />
    </SurfaceCard>
)

/** Draws the library: one card per video with its status, facts and commands, or the empty state. */
export const VideoLibraryBase = (props: VideoLibraryBaseProps) => (
    <div className={LIBRARY_STACK}>
        {props.props.viewOnly === null ? null : <Alert tone="cautionary" title={props.props.viewOnly} />}
        <VideoErrorAlert
            message={props.props.error}
            dismissLabel={props.props.dismissLabel}
            onDismiss={props.on.dismissError}
        />
        <SectionHeader level={2} title={props.props.title} meta={props.props.meta} />
        {props.props.entries.length === 0 ? (
            emptyOf(props.props, props.on.create)
        ) : (
            <List className={LIBRARY_GRID} label={props.props.title}>
                {props.props.entries.map((entry) => (
                    <ListItem key={entry.id} className={LIBRARY_CELL}>
                        <SurfaceCard ariaLabel={entry.title} height="fill">
                            <div className={LIBRARY_CARD}>
                                {entry.posterUrl === null ? (
                                    <Text size="sm" tone="muted">
                                        {entry.noPoster}
                                    </Text>
                                ) : (
                                    <Image src={entry.posterUrl} alt={entry.title} aspect="landscape" fit="contain" />
                                )}
                                <div className={LIBRARY_COPY}>
                                    <Text weight="semibold" overflow="clamp-2">
                                        {entry.title}
                                    </Text>
                                    <div className={LIBRARY_ROW}>
                                        <Badge tone={entry.statusTone}>{entry.statusLabel}</Badge>
                                        <Badge tone="neutral">{entry.goalLabel}</Badge>
                                        <Badge tone="neutral">{entry.aspectLabel}</Badge>
                                    </div>
                                    <Text size="xs" tone="muted">
                                        {entry.facts}
                                    </Text>
                                </div>
                                <div className={LIBRARY_ROW}>
                                    <Button size="sm" intent="neutral" href={entry.href}>
                                        {props.props.openLabel}
                                    </Button>
                                    {props.props.canEdit ? (
                                        <Button
                                            size="sm"
                                            intent="neutral"
                                            isDisabled={props.props.busy}
                                            onPress={() => props.on.duplicate(entry.id)}
                                        >
                                            {props.props.duplicateLabel}
                                        </Button>
                                    ) : null}
                                    {props.props.canEdit ? (
                                        <Button
                                            size="sm"
                                            intent="neutral"
                                            isDisabled={props.props.busy || entry.archiveDisabled}
                                            onPress={() => props.on.archive(entry.id)}
                                        >
                                            {props.props.archiveLabel}
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </SurfaceCard>
                    </ListItem>
                ))}
            </List>
        )}
    </div>
)
