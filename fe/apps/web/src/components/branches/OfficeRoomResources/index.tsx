import { EmptyNotice, Section, type ListRowData } from "@starci/grammar/common"
import type { OfficeChannelRowView, OfficeJumpRowView, OfficePinRowView, OfficeInfoPanelProps } from "@/modules/types"

/** What the room resources draw: the channels of the room and its pinned documents. */
type OfficeRoomResourcesProps = {
    /** The pending result cards of the room; each jumps to its card in the thread. */
    readonly cards: ReadonlyArray<OfficeJumpRowView>
    readonly onJump: (id: string) => void
    readonly channels: ReadonlyArray<OfficeChannelRowView>
    readonly pins: ReadonlyArray<OfficePinRowView>
    readonly copy: OfficeInfoPanelProps["props"]["copy"]
}

/** Result cards, channel state and pinned documents are unpainted sections of the room's existing pane. */
export const OfficeRoomResources = (props: OfficeRoomResourcesProps) => (
    <>
        {props.cards.length === 0 ? null : (
            <ResourceList
                title={props.copy.cardsTitle}
                count={props.cards.length}
                items={props.cards.map((card) => ({
                    id: card.id,
                    title: card.title,
                    description: card.subtitle,
                    action: { label: card.title, press: () => props.onJump(card.id) },
                }))}
            />
        )}
        {props.channels.length === 0 ? null : (
            <ResourceList
                title={props.copy.channelsTitle}
                count={props.channels.length}
                items={props.channels.map((channel) => ({
                    id: channel.id,
                    title: channel.name,
                    ...(channel.detail === "" ? {} : { description: channel.detail }),
                    badges: [
                        { label: channel.statusLabel, tone: channel.isConnected ? "success" : "warning", isDot: true },
                    ] as const,
                }))}
            />
        )}
        {props.pins.length === 0 ? null : (
            <ResourceList
                title={props.copy.pinsTitle}
                items={props.pins.map((pin) => ({
                    id: pin.id,
                    title: pin.title,
                    ...(pin.note === "" ? {} : { description: pin.note }),
                    ...(pin.href === null ? {} : { href: pin.href }),
                }))}
            />
        )}
    </>
)

interface ResourceListProps {
    readonly title: string
    readonly count?: number
    readonly items: ReadonlyArray<ListRowData>
}
/** Every resource collection uses the existing unpainted pane and its own real empty sentence. */
const ResourceList = (props: ResourceListProps) => (
    <Section
        kind="list"
        title={props.title}
        {...(props.count === undefined ? {} : { count: props.count })}
        items={props.items}
        empty={<EmptyNotice message={props.title} />}
    />
)
