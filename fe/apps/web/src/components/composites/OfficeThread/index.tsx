import { useEffect, useRef } from "react"
import { Button, ChatBubbleSkeletons, Divider, EmptyNotice, Text } from "@starci/grammar/common"
import { OfficeApprovalCard } from "@/components/branches/OfficeApprovalCard"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeExceptionCard } from "@/components/branches/OfficeExceptionCard"
import { OfficeExceptionForm } from "@/components/branches/OfficeExceptionForm"
import { OfficeMessageRow } from "@/components/branches/OfficeMessageRow"
import { OfficeOutboxBubble } from "@/components/branches/OfficeOutboxBubble"
import type { OfficeThreadProps } from "@/modules/types"
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
                {view.state === "ready"
                    ? view.items.map((item) => {
                          if (item.kind === "day") {
                              return (
                                  <div key={item.key} className={DAY_CLASS_NAME}>
                                      <Divider label={item.label} />
                                  </div>
                              )
                          }
                          if (item.kind === "approval") {
                              return (
                                  <OfficeApprovalCard
                                      key={item.key}
                                      approval={item}
                                      avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
                                      text={text}
                                      isBusy={view.busyId === item.id}
                                      onDecide={props.on.decideApproval}
                                  />
                              )
                          }
                          if (item.kind === "exception") {
                              return (
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
                          }
                          if (item.kind === "command") {
                              return (
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
                          }
                          return (
                              <OfficeMessageRow
                                  key={item.key}
                                  message={item}
                                  avatar={item.avatar === null ? null : <OfficeAvatar avatar={item.avatar} size="sm" />}
                                  text={text}
                                  onReply={props.on.reply}
                              />
                          )
                      })
                    : null}
                {view.outbox.map((line) => (
                    <OfficeOutboxBubble key={line.id} line={line} text={text} />
                ))}
                {view.reading === null ? null : (
                    <OfficeCommandCard
                        command={null}
                        ask={view.reading.ask}
                        agent={view.reading.agent}
                        avatar={<OfficeAvatar avatar={view.reading.avatar} size="sm" />}
                        text={text}
                        isBusy={false}
                        onSend={props.on.sendCommand}
                        onCancel={props.on.cancelCommand}
                    />
                )}
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
