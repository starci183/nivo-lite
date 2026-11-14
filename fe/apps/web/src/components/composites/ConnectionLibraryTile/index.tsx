import { Alert, SurfaceCard, type BadgeData, type ItemAction } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { LibraryCard } from "@/modules/types"

/** The resolved commands of one connector tile. */
interface LibraryTileLabels {
    readonly want: string
    readonly wanted: string
    readonly connect: string
    readonly view: string
    readonly openPage: string
}

/** One connector's factual identity, availability and existing actions. */
interface ConnectionLibraryTileProps {
    readonly card: LibraryCard
    readonly labels: LibraryTileLabels
    readonly isLoading: boolean
    readonly onOpen: (id: string) => void
    readonly onWant: (id: string) => void
}

const commandLabelOf = (props: ConnectionLibraryTileProps): string => {
    if (!props.card.canConnect) return props.labels.view
    if (props.card.connected === 0) return props.labels.connect
    return props.card.addLabel
}

/** The tile's one badge: its status in the shared vocabulary (its early-access tag reads in the byline); a planned connector shows none. */
const badgesOf = (card: LibraryCard): readonly [BadgeData] | undefined => {
    if (card.isSoon) return undefined
    const status: BadgeData = {
        label: card.status.label,
        tone: card.status.tone === "muted" ? "neutral" : card.status.tone,
        isDot: card.status.isDot,
    }
    return [status]
}

const actionOf = (props: ConnectionLibraryTileProps): ItemAction => {
    const { card, labels } = props
    if (card.isSoon)
        return {
            label: card.want.isDone ? labels.wanted : labels.want,
            intent: "neutral",
            isPending: card.want.isPending,
            isDisabled: card.want.isDone,
            press: () => props.onWant(card.id),
        }
    if (card.lifeAction !== undefined) return { label: card.lifeAction.label, href: card.lifeAction.href }
    if (card.pageHref !== undefined) return { label: labels.openPage, href: card.pageHref }
    return {
        label: commandLabelOf(props),
        intent: card.connected === 0 && card.isCurrent && card.canConnect ? "alternative" : "neutral",
        press: () => props.onOpen(card.id),
    }
}

/** Preserves the native peer tile, guide target, status feedback and one truthful command or destination. */
export const ConnectionLibraryTile = (props: ConnectionLibraryTileProps) => {
    const { card } = props
    const badges = badgesOf(card)
    return (
        <div {...(card.guide === undefined ? {} : { "data-guide-id": `connections.${card.guide}` })}>
            <SurfaceCard
                kind="tile"
                name={card.name}
                byline={card.byline}
                mark={
                    card.logo === undefined
                        ? { icon: nivoIconSource(card.glyph, "leading") }
                        : { logo: { src: card.logo, alt: "" } }
                }
                height="fill"
                isLoading={props.isLoading}
                description={card.blurb}
                {...(badges === undefined ? { badges: undefined } : { badges })}
                {...(card.isSoon ? { state: "unavailable" } : {})}
                {...(card.want.note === undefined ? {} : { note: <Alert tone="informative" title={card.want.note} /> })}
                action={actionOf(props)}
            />
        </div>
    )
}
