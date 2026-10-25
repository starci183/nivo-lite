import { useEffect, useRef } from "react"
import { Button, ChatBubbleSkeletons, Divider, EmptyNotice, Text } from "@starci/grammar/common"
import { OfficeApprovalCard } from "@/components/branches/OfficeApprovalCard"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeExceptionCard } from "@/components/branches/OfficeExceptionCard"
import { OfficeExceptionForm } from "@/components/branches/OfficeExceptionForm"
import { OfficeMessageStatus } from "@/components/branches/OfficeMessageStatus"
import { OfficeMessageRow } from "@/components/branches/OfficeMessageRow"
import { OfficeOutboxBubble } from "@/components/branches/OfficeOutboxBubble"
import { OfficeResultCard } from "@/components/branches/OfficeResultCard"
import type { OfficeThreadProps, OfficeExceptionView, OfficeCommandView, OfficeApprovalView } from "@/modules/types"
import { BODY_CLASS_NAME, DAY_CLASS_NAME, SCROLL_CLASS_NAME, TYPING_CLASS_NAME } from "./classNames"

const STICK_PX = 80

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
        <div ref={scrollRef} className={SCROLL_CLASS_NAME} role="log" aria-label={text("conversationLabel")}>
            <div className={BODY_CLASS_NAME}>
                {view.state === "loading" ? <ChatBubbleSkeletons count={3} hasAvatar /> : null}
                {view.state === "error" ? (
                    <EmptyNotice
                        message={text("loadFailed")}
                        actionLabel={text("retry")}
                        actionVariant="secondary"
                        onAction={props.on.retry}
                    />
                ) : null}
                {view.state === "ready" && view.hasEarlier ? (
                    <Button variant="ghost" size="sm" isPending={view.isLoadingEarlier} onPress={props.on.loadEarlier}>
                        {text("loadEarlier")}
                    </Button>
                ) : null}
                {view.state === "ready" && view.items.length === 0 ? (
                    <EmptyNotice message={text("emptyMessage")} description={text("emptyMessageHint")} />
                ) : null}
                {renderOfficeThreadItems(props)}
                {view.outbox.map((line) => (
                    <OfficeOutboxBubble key={line.id} line={line} text={text} />
                ))}
                {view.reading === null ? null : renderOfficeThreadReading(view.reading, text, props)}
                <div className={TYPING_CLASS_NAME}>
                    {view.typing === "" ? null : (
                        <Text size="sm" tone="muted" live="polite">
                            {view.typing}
                        </Text>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Renders the OfficeThread exception section. */
const renderOfficeThreadException = (
    item: OfficeExceptionView,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    view: OfficeThreadProps["props"],
    props: OfficeThreadProps,
) => (
    <OfficeExceptionCard
        key={item.key}
        item={item}
        avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
        text={text}
        form={
            <OfficeExceptionForm
                item={item}
                text={text}
                isBusy={view.busyId === item.id}
                onDecide={props.on.decideWork}
            />
        }
    />
)

/** Renders the OfficeThread command section. */
const renderOfficeThreadCommand = (
    item: OfficeCommandView,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    view: OfficeThreadProps["props"],
    props: OfficeThreadProps,
) => (
    <OfficeCommandCard
        key={item.key}
        command={item}
        ask={item.ask}
        agent={item.agent}
        avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
        text={text}
        isBusy={view.busyId === item.id}
        onSend={props.on.sendCommand}
        onCancel={props.on.cancelCommand}
    />
)

/** Renders the OfficeThread reading section. */
const renderOfficeThreadReading = (
    reading: NonNullable<OfficeThreadProps["props"]["reading"]>,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    props: OfficeThreadProps,
) => (
    <OfficeCommandCard
        command={null}
        ask={reading.ask}
        agent={reading.agent}
        avatar={<OfficeAvatar avatar={reading.avatar} size="sm" />}
        text={text}
        isBusy={false}
        onSend={props.on.sendCommand}
        onCancel={props.on.cancelCommand}
    />
)

/** Renders the OfficeThread approval section. */
const renderOfficeThreadApproval = (
    item: OfficeApprovalView,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    view: OfficeThreadProps["props"],
    props: OfficeThreadProps,
) => (
    <OfficeApprovalCard
        key={item.key}
        approval={item}
        avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
        text={text}
        isBusy={view.busyId === item.id}
        onDecide={props.on.decideApproval}
    />
)

/** Renders settled thread items and their decision cards. */
const renderOfficeThreadItems = (props: OfficeThreadProps) => {
    const view = props.props
    const { text } = view
    return view.state === "ready"
        ? view.items.map((item) => {
              if (item.kind === "day") {
                  return (
                      <div key={item.key} className={DAY_CLASS_NAME}>
                          <Divider label={item.label} />
                      </div>
                  )
              }
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
                      onReply={props.on.reply}
                  />
              )
          })
        : null
}
