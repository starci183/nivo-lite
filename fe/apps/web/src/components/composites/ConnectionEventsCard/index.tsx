import { Badge, EmptyNotice, SurfaceCard, type BadgeTone, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** One live event of a connection: what came in or happened, the line under it, how it ended, and when. */
export interface ConnectionEventLine {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly verdict?: "success" | "danger"
    /** The time it happened, already worded ("14:31", "2 minutes ago"). */
    readonly at?: string
    readonly badge?: { readonly label: string; readonly tone: BadgeTone; readonly isDot?: boolean }
    /** A command on the line (retry a failed file); absent on most lines. */
    readonly action?: { readonly label: string; readonly run: () => void }
}

/** Fake lines of the same shape: the skeleton reuses the ready tree. */
export const CONNECTION_EVENTS_PLACEHOLDER: ReadonlyArray<ConnectionEventLine> = [
    { id: "one", title: "-", description: "-", at: "-" },
    { id: "two", title: "-", description: "-", at: "-" },
    { id: "three", title: "-", description: "-", at: "-" },
]

/** What the events card draws. */
interface ConnectionEventsCardProps {
    /** "Zalo events", already in the reader's language. */
    readonly title: string
    /** The live mark beside the title. */
    readonly liveLabel: string
    /** The feed is live: the mark shows. False while the source is not connected yet, so the card claims no live feed. Default true. */
    readonly isLive?: boolean
    /** The glyph of the empty card, after the source (a document for Drive). Default the chat bubble. */
    readonly emptyGlyph?: IconName
    readonly lines: ReadonlyArray<ConnectionEventLine>
    readonly emptyMessage: string
    readonly emptyHint: string
    /**
     * The next step of the empty card. `neutral` when the page's band already shows a filled primary, so the page never has two;
     * default `commit`.
     */
    readonly emptyAction?: { readonly label: string; readonly run: () => void; readonly intent?: "commit" | "neutral" }
    readonly isLoading: boolean
}

/**
 * The live events of a connection, newest first: each line with its outcome edge, the line under it and its time; before the first
 * event, what will show here.
 */
export const ConnectionEventsCard = (props: ConnectionEventsCardProps) => (
    <SurfaceCard
        kind="list"
        label={props.title}
        {...(props.isLive === false
            ? {}
            : {
                  labelEnd: (
                      <Badge tone="success" isDot>
                          {props.liveLabel}
                      </Badge>
                  ),
              })}
        isLoading={props.isLoading}
        items={props.lines.map((line): ListRowData => ({
            id: line.id,
            title: line.title,
            description: line.description,
            ...(line.verdict === undefined ? {} : { verdict: line.verdict }),
            ...(line.at === undefined ? {} : { meta: { text: line.at } }),
            ...(line.badge === undefined
                ? {}
                : {
                      badges: [
                          {
                              label: line.badge.label,
                              tone: line.badge.tone,
                              ...(line.badge.isDot === true ? { isDot: true } : {}),
                          },
                      ],
                  }),
            ...(line.action === undefined ? {} : { action: { label: line.action.label, press: line.action.run } }),
        }))}
        empty={
            <EmptyNotice
                message={props.emptyMessage}
                description={props.emptyHint}
                iconSource={nivoIconSource(props.emptyGlyph ?? "chat", "leading")}
                {...(props.emptyAction === undefined
                    ? {}
                    : {
                          actionLabel: props.emptyAction.label,
                          onAction: props.emptyAction.run,
                          ...(props.emptyAction.intent === undefined ? {} : { actionIntent: props.emptyAction.intent }),
                      })}
            />
        }
    />
)
