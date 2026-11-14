import type { ReactElement } from "react"
import { Link, Meter, Stack, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { InboxCopy, InboxView } from "@/modules/types"

/** Props for {@link BrainInboxRail}. */
interface BrainInboxRailProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly inbox: InboxView
    }
    readonly on: {
        readonly dismissAsk: (id: string) => void
    }
}

/** What a side card of the rail draws: its title with the count, its rows and what stands under them. */
interface SideCardProps {
    readonly title: string
    readonly rows: ReadonlyArray<ListRowData>
    /** The one navigation link of the head, "… →"; none when the card has no destination. */
    readonly link?: { readonly label: string; readonly href: string }
}

/** The link at the end of a card's head, when it has one. */
const labelEndOf = (link: SideCardProps["link"]) =>
    link === undefined
        ? {}
        : {
              labelEnd: (
                  <Link variant="head" href={link.href}>
                      {link.label}
                  </Link>
              ),
          }

/** A side card with its rows; a card with nothing in it is not drawn, so no empty sentence is said twice. */
const SideCard = (props: SideCardProps): ReactElement | null =>
    props.rows.length === 0 ? null : (
        <SurfaceCard
            kind="list"
            label={props.title}
            count={props.rows.length}
            isAttention
            {...labelEndOf(props.link)}
            items={props.rows}
            empty={null}
        />
    )

/** What the progress card reads. */
interface ProgressingProps {
    readonly copy: InboxCopy
    readonly inbox: InboxView
}

/** How far the agents are: the facts in use of all of them, as a reading (a meter in the foreground colour: red is the one main CTA) and its words. */
const Progressing = (props: ProgressingProps) => {
    const { copy, inbox } = props
    return (
        <SurfaceCard label={copy.progressTitle} note={copy.progressNote}>
            <Meter
                tone="foreground"
                label={copy.progressLabel}
                valueLabel={copy.progressValue}
                value={inbox.progress.used}
                minValue={0}
                maxValue={Math.max(inbox.progress.total, 1)}
            />
        </SurfaceCard>
    )
}

/**
 * The rail of the inbox: how far the agents are, the customer questions nobody answered (answering them goes to the public tab), and the
 * public texts that wait for approval.
 */
export const BrainInboxRail = (props: BrainInboxRailProps) => {
    const { copy, inbox } = props.props
    const dismissAsk = props.on.dismissAsk
    const asks: ReadonlyArray<ListRowData> = inbox.asks.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.line,
        leading: { icon: nivoIconSource("chat", "leading") },
        ...(row.href === null ? {} : { href: row.href }),
        ...(inbox.canWrite
            ? {
                  menu: {
                      label: copy.rowMenu,
                      entries: [{ id: "dismiss", label: copy.dismiss, onAction: () => dismissAsk(row.id) }],
                  },
              }
            : {}),
    }))
    const proposals: ReadonlyArray<ListRowData> = inbox.proposals.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.line,
        leading: { icon: nivoIconSource("document", "leading") },
        actionPlacement: "end",
        ...(row.href === null ? {} : { action: { label: copy.read, href: row.href } }),
    }))
    return (
        <Stack gap="section">
            <Progressing copy={copy} inbox={inbox} />
            <SideCard title={copy.asksTitle} rows={asks} link={{ label: copy.asksMore, href: inbox.asksMoreHref }} />
            <SideCard title={copy.proposalsTitle} rows={proposals} />
        </Stack>
    )
}
