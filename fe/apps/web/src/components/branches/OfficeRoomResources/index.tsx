import type { ReactNode } from "react"
import { Badge, Button, Region, Text } from "@starci/grammar/common"
import type { OfficeChannelRowView, OfficeJumpRowView, OfficePinRowView, OfficeText } from "@/modules/types"
import { ROW_CLASS_NAME, SECTION_CLASS_NAME, TEXT_CLASS_NAME, TITLE_CLASS_NAME } from "./classNames"

/** What the room resources draw: the channels of the room and its pinned documents. */
type OfficeRoomResourcesProps = {
    /** The pending result cards of the room; each jumps to its card in the thread. */
    readonly cards: ReadonlyArray<OfficeJumpRowView>
    readonly onJump: (id: string) => void
    readonly channels: ReadonlyArray<OfficeChannelRowView>
    readonly pins: ReadonlyArray<OfficePinRowView>
    readonly text: OfficeText
}

type SectionProps = {
    readonly title: string
    readonly count: string | null
    readonly children: ReactNode
}

/** One titled section of the room panel. */
const Section = (props: SectionProps) => (
    <Region label={props.title} className={SECTION_CLASS_NAME}>
        <div className={TITLE_CLASS_NAME}>
            <Text weight="semibold">{props.title}</Text>
            {props.count === null ? null : (
                <Text size="sm" tone="muted">
                    {props.count}
                </Text>
            )}
        </div>
        {props.children}
    </Region>
)

/** The room's pending result cards, the channels its agents answer on and its pinned documents; empty parts are not drawn. */
export const OfficeRoomResources = (props: OfficeRoomResourcesProps) => (
    <>
        {props.cards.length === 0 ? null : (
            <Section title={props.text("cardsTitle")} count={`${props.cards.length}`}>
                {props.cards.map((card) => (
                    <div key={card.id} className={TEXT_CLASS_NAME}>
                        <Button variant="ghost" size="sm" onPress={() => props.onJump(card.id)}>
                            {card.title}
                        </Button>
                        <Text size="xs" tone="muted" overflow="truncate">
                            {card.subtitle}
                        </Text>
                    </div>
                ))}
            </Section>
        )}
        {props.channels.length === 0 ? null : (
            <Section title={props.text("channelsTitle")} count={`${props.channels.length}`}>
                {props.channels.map((channel) => (
                    <div key={channel.id} className={ROW_CLASS_NAME}>
                        <div className={TEXT_CLASS_NAME}>
                            <Text weight="medium" overflow="truncate">
                                {channel.name}
                            </Text>
                            {channel.detail === "" ? null : (
                                <Text size="sm" tone="muted" overflow="truncate">
                                    {channel.detail}
                                </Text>
                            )}
                        </div>
                        <Badge tone={channel.isConnected ? "success" : "warning"} isDot>
                            {channel.statusLabel}
                        </Badge>
                    </div>
                ))}
            </Section>
        )}
        {props.pins.length === 0 ? null : (
            <Section title={props.text("pinsTitle")} count={null}>
                {props.pins.map((pin) => (
                    <div key={pin.id} className={TEXT_CLASS_NAME}>
                        {pin.href === null ? (
                            <Text weight="medium" overflow="truncate">
                                {pin.title}
                            </Text>
                        ) : (
                            <Button variant="ghost" size="sm" href={pin.href}>
                                {pin.title}
                            </Button>
                        )}
                        {pin.note === "" ? null : (
                            <Text size="xs" tone="muted">
                                {pin.note}
                            </Text>
                        )}
                    </div>
                ))}
            </Section>
        )}
    </>
)
