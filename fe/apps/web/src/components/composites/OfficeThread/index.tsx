import { useEffect, useRef } from "react"
import { Button, ChatBubbleSkeletons, Divider, EmptyNotice, Text, VerticalScrollRegion } from "@starci/grammar/common"
import { OfficeApprovalCard } from "@/components/branches/OfficeApprovalCard"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeExceptionCard } from "@/components/branches/OfficeExceptionCard"
import { OfficeExceptionForm } from "@/components/branches/OfficeExceptionForm"
import { OfficeMessageStatus } from "@/components/branches/OfficeMessageStatus"
import { OfficeMessageRow } from "@/components/branches/OfficeMessageRow"
import { OfficeOutboxBubble } from "@/components/branches/OfficeOutboxBubble"
import { OfficeResultCard } from "@/components/branches/OfficeResultCard"
import type { OfficeCommandView, OfficeThreadProps } from "@/modules/types"
import { BAND_CLASS_NAME, BODY_CLASS_NAME, DAY_CLASS_NAME, SCROLL_CLASS_NAME, TYPING_CLASS_NAME } from "./classNames"

const STICK_PX = 80

/** A thread item that sits in an inset band: every kind but the day divider. */
type OfficeThreadBandItem = Exclude<OfficeThreadProps["props"]["items"][number], { readonly kind: "day" }>

/** The thread: day dividers, lines, approval, exception and command cards, the unsent lines, pinned to the newest. */
export const OfficeThread = (props: OfficeThreadProps) => {
    const view = props.props
    const { text } = view
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const stickRef = useRef(true)

    useEffect(() => {
        const node = scrollRef.current
        if (node !== null && stickRef.current) node.scrollTop = node.scrollHeight
    }, [view.items.length, view.outbox.length, view.typing, view.reading])

    useEffect(() => {
        const node = scrollRef.current
        if (node === null) return undefined
        const onScroll = () => {
            stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_PX
        }
        node.addEventListener("scroll", onScroll, { passive: true })
        return () => node.removeEventListener("scroll", onScroll)
    }, [])

    return (
        <VerticalScrollRegion
            isScrollable
            ref={scrollRef}
            className={SCROLL_CLASS_NAME}
            role="log"
            aria-label={text("conversationLabel")}
        >
            <div className={BODY_CLASS_NAME}>
                {view.isSkeleton ? (
                    <div className={BAND_CLASS_NAME}>
                        <ChatBubbleSkeletons count={3} hasAvatar />
                    </div>
                ) : null}
                {!view.isSkeleton && view.hasEarlier ? (
                    <div className={BAND_CLASS_NAME}>
                        <Button
                            intent="neutral"
                            size="sm"
                            isPending={view.isLoadingEarlier}
                            onPress={props.on.loadEarlier}
                        >
                            {text("loadEarlier")}
                        </Button>
                    </div>
                ) : null}
                {!view.isSkeleton && view.items.length === 0 ? (
                    <div className={BAND_CLASS_NAME}>
                        <EmptyNotice message={text("emptyMessage")} description={text("emptyMessageHint")} />
                    </div>
                ) : null}
                {renderOfficeThreadItems(props)}
                {view.outbox.map((line) => (
                    <div key={line.id} className={BAND_CLASS_NAME}>
                        <OfficeOutboxBubble line={line} text={text} />
                    </div>
                ))}
                {view.reading === null ? null : (
                    <div className={BAND_CLASS_NAME}>{renderOfficeThreadCommand(null, view.reading, props)}</div>
                )}
                <div className={BAND_CLASS_NAME}>
                    <div className={TYPING_CLASS_NAME}>
                        {view.typing === "" ? null : (
                            <Text size="sm" tone="muted" live="polite">
                                {view.typing}
                            </Text>
                        )}
                    </div>
                </div>
            </div>
        </VerticalScrollRegion>
    )
}

/** Renders settled thread items: a day divider spans the column, every other item sits in an inset band. */
const renderOfficeThreadItems = (props: OfficeThreadProps) =>
    props.props.isSkeleton
        ? null
        : props.props.items.map((item) =>
              item.kind === "day" ? (
                  <div key={item.key} className={DAY_CLASS_NAME}>
                      <Divider label={item.label} />
                  </div>
              ) : (
                  <div key={item.key} className={BAND_CLASS_NAME}>
                      {renderOfficeThreadItem(item, props)}
                  </div>
              ),
          )

/** Renders one settled, non-day thread item or its decision card. */
const renderOfficeThreadItem = (item: OfficeThreadBandItem, props: OfficeThreadProps) => {
    const { props: view, on } = props
    const { text } = view
    const avatar = item.avatar === null ? null : <OfficeAvatar avatar={item.avatar} size="sm" />
    if (item.kind === "approval") {
        return (
            <OfficeApprovalCard
                key={item.key}
                approval={item}
                avatar={avatar}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={on.editCard}
                isBusy={view.busyId === item.id}
                onDecide={on.decideApproval}
            />
        )
    }
    if (item.kind === "exception") {
        const form = (
            <OfficeExceptionForm
                item={item}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={on.editCard}
                isBusy={view.busyId === item.id}
                onDecide={on.decideWork}
            />
        )
        return <OfficeExceptionCard key={item.key} item={item} avatar={avatar} text={text} form={form} />
    }
    if (item.kind === "command") return renderOfficeThreadCommand(item, item, props)
    if (item.kind === "card") {
        return (
            <OfficeResultCard
                key={item.key}
                card={item}
                avatar={avatar}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={on.editCard}
                isBusy={item.refId !== null && view.busyId === item.refId}
                onDecide={on.decideCard}
            />
        )
    }
    const status = item.status === null ? null : <OfficeMessageStatus status={item.status} text={text} />
    return (
        <OfficeMessageRow
            key={item.key}
            message={item}
            avatar={avatar}
            text={text}
            status={status}
            isCopied={view.copiedKey === item.key}
            onReply={on.reply}
            onCopy={on.copy}
        />
    )
}

/** Renders a command card: the settled command item, or the one being prepared while NIVO reads the line (no command yet). */
const renderOfficeThreadCommand = (
    command: OfficeCommandView | null,
    from: Pick<NonNullable<OfficeThreadProps["props"]["reading"]>, "ask" | "agent" | "avatar">,
    props: OfficeThreadProps,
) => (
    <OfficeCommandCard
        key={command?.key}
        command={command}
        ask={from.ask}
        agent={from.agent}
        avatar={<OfficeAvatar avatar={from.avatar} size="sm" />}
        text={props.props.text}
        isBusy={command !== null && props.props.busyId === command.id}
        onSend={props.on.sendCommand}
        onCancel={props.on.cancelCommand}
    />
)
