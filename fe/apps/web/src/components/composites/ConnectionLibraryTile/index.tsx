import { Alert, Badge, Stack, SurfaceCard } from "@starci/grammar/common"
import type { BadgeData, ItemAction } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { LibraryCard } from "@/modules/types"

/** The resolved commands of one connector tile. */
interface LibraryTileLabels {
    readonly want: string
    readonly wanted: string
    readonly connect: string
    readonly add: string
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
    return props.labels.add
}

const badgeOf = (card: LibraryCard): BadgeData | undefined => {
    if (card.tag !== null) return card.tag
    if (card.isSoon) return undefined
    return {
        label: card.status.label,
        tone: card.status.tone === "muted" ? "neutral" : card.status.tone,
        isDot: card.status.isDot,
    }
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
    const badge = badgeOf(card)
    const hasFooter = card.want.note !== undefined || (card.tag !== null && !card.isSoon)
    return (
        <div {...(card.guide === undefined ? {} : { "data-guide": `connections.${card.guide}` })}>
            <SurfaceCard
                kind="tile"
                name={card.name}
                mark={
                    card.logo === undefined
                        ? { icon: nivoIconSource(card.glyph, "leading") }
                        : { logo: { src: card.logo, alt: "" } }
                }
                height="fill"
                isLoading={props.isLoading}
                description={`${card.audienceLine} · ${card.blurb}`}
                {...(badge === undefined ? {} : { badge })}
                {...(card.isSoon ? { state: "unavailable" } : {})}
                {...(!hasFooter
                    ? {}
                    : {
                          footer: (
                              <Stack gap="inline">
                                  {card.tag !== null && !card.isSoon ? (
                                      <Badge
                                          tone={card.status.tone === "muted" ? "neutral" : card.status.tone}
                                          isDot={card.status.isDot}
                                          isLoading={props.isLoading}
                                      >
                                          {card.status.label}
                                      </Badge>
                                  ) : null}
                                  {card.want.note === undefined ? null : (
                                      <Alert tone="informative" title={card.want.note} />
                                  )}
                              </Stack>
                          ),
                      })}
                action={actionOf(props)}
            />
        </div>
    )
}
