import type { VideoLibraryActions, VideoLibraryViews } from "@/modules/types"
type VideoLibraryListFields = VideoLibraryViews["library"]
type VideoLibraryListActions = VideoLibraryActions["library"]

interface VideoLibraryListProps extends VideoLibraryListFields {
    readonly isLoading: boolean
    readonly on: VideoLibraryListActions
}
import { Alert, EmptyNotice, Grid, Section, Stack, SurfaceCard } from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"

const emptyOf = (props: Omit<VideoLibraryListProps, "on">, create: () => void) => (
    <SurfaceCard isLoading={props.isLoading} ariaLabel={props.emptyTitle}>
        <EmptyNotice
            message={props.emptyTitle}
            description={props.emptyBody}
            {...(props.canEdit ? { actionLabel: props.newLabel, onAction: create } : {})}
        />
    </SurfaceCard>
)

type VideoLibraryEntry = VideoLibraryListProps["entries"][number]

const cardOf = (props: VideoLibraryListProps, entry: VideoLibraryEntry) => (
    <SurfaceCard
        isLoading={props.isLoading}
        key={entry.id}
        kind="tile"
        name={entry.title}
        height="fill"
        poster={
            entry.posterUrl === null
                ? { absence: entry.noPoster, aspect: "landscape" }
                : {
                      image: { src: entry.posterUrl, alt: entry.title },
                      aspect: "landscape",
                      fit: "contain",
                  }
        }
        badges={[
            { label: entry.statusLabel, tone: entry.statusTone },
            { label: entry.goalLabel, tone: "neutral" },
            { label: entry.aspectLabel, tone: "neutral" },
        ]}
        facts={entry.facts}
        action={{ label: props.openLabel, href: entry.href }}
        {...(props.canEdit
            ? {
                  menu: {
                      label: props.menuLabel,
                      entries: [
                          {
                              id: "duplicate",
                              label: props.duplicateLabel,
                              isDisabled: props.busy,
                              onAction: () => props.on.duplicate(entry.id),
                          },
                          {
                              id: "archive",
                              label: props.archiveLabel,
                              isDisabled: props.busy || entry.archiveDisabled,
                              onAction: () => props.on.archive(entry.id),
                          },
                      ],
                  },
              }
            : {})}
    />
)

/** Draws the library: one card per video with its status, facts and commands, or the empty state. */
export const VideoLibraryList = (props: VideoLibraryListProps) => {
    const libraryBody =
        props.entries.length === 0 ? (
            emptyOf(props, props.on.create)
        ) : (
            <Grid kind="cards" columns={3}>
                {props.entries.map((entry) => cardOf(props, entry))}
            </Grid>
        )
    return (
        <Stack gap="section">
            {props.viewOnly === null ? null : <Alert tone="cautionary" title={props.viewOnly} />}
            <VideoErrorAlert
                message={props.error}
                dismissLabel={props.dismissLabel}
                onDismiss={props.on.dismissError}
            />
            <Section isLoading={props.isLoading} headingLevel={2} title={props.title} meta={props.meta}>
                {props.isLoading ? null : libraryBody}
            </Section>
        </Stack>
    )
}
