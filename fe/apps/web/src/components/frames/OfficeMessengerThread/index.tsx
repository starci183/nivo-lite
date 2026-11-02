import type { ReactElement } from "react"
import { Stack, Text } from "@starci/grammar/common"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeThread } from "@/components/composites/OfficeThread"
import { OfficeThreadCardBody } from "@/components/composites/OfficeThreadCardBody"
import { OfficeCardFrame } from "@/components/composites/OfficeCardFrame"
import type { OfficeThreadItem, OfficeThreadProps } from "@/modules/types"

type OfficeMessengerThread = Pick<
    OfficeThreadProps["props"],
    | "cards"
    | "items"
    | "outbox"
    | "reading"
    | "typing"
    | "busyId"
    | "basisMin"
    | "cardCopy"
    | "copy"
    | "receipts"
    | "copiedKey"
    | "hasEarlier"
    | "isLoadingEarlier"
>

type OfficeCardItem = Exclude<OfficeThreadItem, { readonly kind: "day" | "message" }>
type MessengerThreadProps = {
    readonly thread: OfficeMessengerThread
    readonly isLoading: boolean
    readonly labels: { readonly nivoCore: string; readonly aiBadge: string }
    readonly on: OfficeThreadProps["on"]
}
type MessengerCardProps = {
    readonly item: OfficeCardItem
    readonly busyId: string | null
    readonly basisMin: number
    readonly cardCopy: OfficeMessengerThread["cardCopy"]
    readonly draft: OfficeMessengerThread["cards"][number]["draft"]
    readonly label: string
    readonly basisDescription: string | null
    readonly labels: { readonly nivoCore: string; readonly aiBadge: string }
    readonly on: OfficeThreadProps["on"]
}

/** Card slots are assembled here, so no card branch imports the frame above its tier. */
export const OfficeMessengerThread = (props: MessengerThreadProps) => {
    const cards = new Map(
        props.thread.cards.map<[string, ReactElement]>(({ item, draft, label, basisDescription }) => [
            item.key,
            <MessengerCard
                key={item.key}
                item={item}
                draft={draft}
                label={label}
                basisDescription={basisDescription}
                labels={props.labels}
                busyId={props.thread.busyId}
                basisMin={props.thread.basisMin}
                cardCopy={props.thread.cardCopy}
                on={props.on}
            />,
        ]),
    )
    return (
        <OfficeThread
            props={{ ...props.thread, isLoading: props.isLoading }}
            on={{ loadEarlier: props.on.loadEarlier, reply: props.on.reply, copy: props.on.copy }}
            cardNodes={cards}
            readingCard={
                <MessengerReadingCard
                    reading={props.thread.reading}
                    commandCopy={props.thread.cardCopy.command}
                    nivoCore={props.labels.nivoCore}
                    onSend={props.on.sendCommand}
                    onCancel={props.on.cancelCommand}
                />
            }
        />
    )
}

/** A settled card retains its exact author, anchor, avatar, AI mark, time and focus, above its original controls. */
const MessengerCard = (props: MessengerCardProps) => {
    const { item, on } = props
    const refId = item.kind === "card" ? item.refId : item.id
    return (
        <OfficeCardFrame
            {...(item.kind === "approval"
                ? {
                      id: item.anchor,
                      author: item.author,
                      meta: item.time,
                      label: item.title,
                      isHighlight: item.isFocused,
                  }
                : {})}
            {...(item.kind === "command" ? { id: item.anchor, author: props.labels.nivoCore, label: props.label } : {})}
            {...(item.kind === "exception" || item.kind === "card"
                ? { identity: item, aiLabel: props.labels.aiBadge }
                : {})}
            avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
            head={<MessengerCardHead item={item} />}
            content={
                <OfficeThreadCardBody
                    item={item}
                    draft={props.draft}
                    isBusy={refId !== null && props.busyId === refId}
                    basisMin={props.basisMin}
                    basisDescription={props.basisDescription}
                    copy={props.cardCopy}
                    onEdit={on.editCard}
                    onDecideApproval={on.decideApproval}
                    onDecideWork={on.decideWork}
                    onDecideCard={on.decideCard}
                    onSend={on.sendCommand}
                    onCancel={on.cancelCommand}
                />
            }
        />
    )
}

/** Each message head keeps its original words, emphasis and order. */
const MessengerCardHead = (props: Pick<MessengerCardProps, "item">) => {
    const item = props.item
    if (item.kind === "command") return <Text as="p">{item.ask}</Text>
    if (item.kind === "card") return item.lead === null ? <Text isStrong>{item.title}</Text> : <Text>{item.lead}</Text>
    const subtitle = item.kind === "approval" ? item.target : item.hint
    return (
        <Stack gap="identity">
            {item.title === "" && item.kind === "approval" ? null : <Text isStrong>{item.title}</Text>}
            {subtitle === null ? null : (
                <Text size="sm" tone="muted">
                    {subtitle}
                </Text>
            )}
        </Stack>
    )
}

type MessengerReadingCardProps = {
    readonly reading: OfficeMessengerThread["reading"]
    readonly commandCopy: OfficeMessengerThread["cardCopy"]["command"]
    readonly nivoCore: string
    readonly onSend: OfficeThreadProps["on"]["sendCommand"]
    readonly onCancel: OfficeThreadProps["on"]["cancelCommand"]
}

/** Reading has no command or anchor yet, and keeps its real native loading controls. */
const MessengerReadingCard = (props: MessengerReadingCardProps) => {
    const reading = props.reading
    if (reading === null) return null
    return (
        <OfficeCardFrame
            author={props.nivoCore}
            label={reading.label}
            avatar={<OfficeAvatar avatar={reading.avatar} size="sm" />}
            head={
                <Text as="p" isLoading>
                    {reading.ask}
                </Text>
            }
            content={
                <OfficeCommandCard
                    command={null}
                    agent={reading.agent}
                    copy={props.commandCopy}
                    gateNote={reading.gateNote}
                    isBusy={false}
                    onSend={props.onSend}
                    onCancel={props.onCancel}
                />
            }
        />
    )
}
