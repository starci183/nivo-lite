import { useEffect, useRef } from "react"
import { Button, ChatBubbleSkeletons, Divider, EmptyNotice, Text, VerticalScrollRegion } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeMessageStatus } from "@/components/branches/OfficeMessageStatus"
import { OfficeMessageRow } from "@/components/branches/OfficeMessageRow"
import { OfficeOutboxBubble } from "@/components/branches/OfficeOutboxBubble"
import { OfficeResultCard } from "@/components/branches/OfficeResultCard"
import type { OfficeThreadProps } from "@/modules/types"
import {
    renderOfficeThreadApproval,
    renderOfficeThreadCommand,
    renderOfficeThreadException,
    renderOfficeThreadReading,
} from "./renderCards"
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
            tone="background"
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
                    <div className={BAND_CLASS_NAME}>{renderOfficeThreadReading(view.reading, text, props)}</div>
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
    const view = props.props
    const { text } = view
    if (item.kind === "approval") {
        return renderOfficeThreadApproval(item, text, view, props)
    }
    if (item.kind === "exception") {
        return renderOfficeThreadException(item, text, view, props)
    }
    if (item.kind === "command") {
        return renderOfficeThreadCommand(item, text, view, props)
    }
    if (item.kind === "card") {
        return (
            <OfficeResultCard
                key={item.key}
                card={item}
                avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={props.on.editCard}
                isBusy={item.refId !== null && view.busyId === item.refId}
                onDecide={props.on.decideCard}
            />
        )
    }
    return (
        <OfficeMessageRow
            key={item.key}
            message={item}
            avatar={item.avatar === null ? null : <OfficeAvatar avatar={item.avatar} size="sm" />}
            text={text}
            status={item.status === null ? null : <OfficeMessageStatus status={item.status} text={text} />}
            isCopied={view.copiedKey === item.key}
            onReply={props.on.reply}
            onCopy={props.on.copy}
        />
    )
}
