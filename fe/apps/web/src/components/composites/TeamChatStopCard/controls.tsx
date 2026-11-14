import { useState } from "react"
import { Button, Cluster, Stack, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { TeamChatStopAction, TeamChatStopCardView } from "@/modules/types"
import { STOP_ANSWER_CLASS_NAME } from "./classNames"
import { StopLinesList } from "./lists"

/** The controls of a stop card (the answer box takes exactly these): the card, whether an action of it is in flight, and the one handler. */
export interface StopAnswerBoxProps {
    readonly card: TeamChatStopCardView
    readonly isPending: boolean
    readonly act: (action: TeamChatStopAction) => void
}

/** The answer box of an open AI stop: the suggestions (a press sends that text), then the field and the one red send. */
export const StopAnswerBox = (props: StopAnswerBoxProps) => {
    const { card } = props
    const [draft, setDraft] = useState({ revision: card.revision, text: "" })
    const text = draft.revision === card.revision ? draft.text : ""
    const send = (): void => {
        if (text.trim() === "" || props.isPending) return
        props.act({ kind: "answer", text: text.trim() })
        setDraft({ revision: card.revision, text: "" })
    }
    return (
        <Stack gap="row">
            {card.suggestions.length === 0 ? null : (
                <SurfaceCard
                    kind="list"
                    layout="suggestions"
                    label={card.labels.suggestionsLabel}
                    empty={null}
                    items={card.suggestions.map((suggestion) => ({
                        id: suggestion,
                        title: suggestion,
                        onPress: () => {
                            if (!props.isPending) props.act({ kind: "answer", text: suggestion })
                        },
                    }))}
                />
            )}
            <Cluster gap="inline" align="end" wrap={false}>
                <div className={STOP_ANSWER_CLASS_NAME}>
                    <Textarea
                        label={card.labels.answerLabel}
                        isLabelHidden
                        placeholder={card.answerPlaceholder}
                        value={text}
                        onValueChange={(value) => setDraft({ revision: card.revision, text: value })}
                        onSubmitShortcut={send}
                    />
                </div>
                <Button intent="commit" startGlyph="send" isPending={props.isPending} isDisabled={text.trim() === ""} onPress={send}>
                    {card.labels.send}
                </Button>
            </Cluster>
        </Stack>
    )
}

/** The words of a decision button. */
const decisionLabelOf = (card: TeamChatStopCardView, decision: TeamChatStopCardView["decisions"][number]): string => {
    if (decision === "retry") return card.labels.retry
    return decision === "take_over" ? card.labels.takeOver : card.labels.skip
}

/** The decisions row takes the same controls as the answer box. */
export type StopDecisionsRowProps = Pick<StopAnswerBoxProps, "card" | "isPending" | "act">

/** The neutral decisions the engine accepts now (retry, take over, skip). */
export const StopDecisionsRow = (props: StopDecisionsRowProps) => (
    <Cluster gap="inline" label={props.card.labels.decisionsLabel}>
        {props.card.decisions.map((decision) => (
            <Button
                key={decision}
                intent="neutral"
                size="sm"
                isDisabled={props.isPending}
                onPress={() => props.act({ kind: "decision", decision })}
            >
                {decisionLabelOf(props.card, decision)}
            </Button>
        ))}
    </Cluster>
)

/** What a person is asked to approve, whole: the message as the customer will get it and the files it sends, each in one bordered row. */
const StopApprovalContent = (props: { readonly card: TeamChatStopCardView }) => {
    const { card } = props
    const approval = card.approval
    if (approval === null) return null
    const rows = [
        ...(approval.messageLines.length === 0
            ? []
            : [
                  {
                      id: "message",
                      title: card.labels.messageLabel,
                      value: (
                          <Stack gap="row">
                              {approval.messageLines.map((line, index) => (
                                  <Text key={`${String(index)}-${line}`}>{line}</Text>
                              ))}
                          </Stack>
                      ),
                  },
              ]),
        ...(approval.files.length === 0
            ? []
            : [
                  {
                      id: "files",
                      title: card.labels.filesLabel,
                      value: (
                          <Stack gap="row">
                              {approval.files.map((address, index) => (
                                  <Text key={`${String(index)}-${address}`}>{address}</Text>
                              ))}
                          </Stack>
                      ),
                  },
              ]),
    ]
    return rows.length === 0 ? null : (
        <SurfaceCard kind="list" layout="keyValue" ariaLabel={card.labels.messageLabel} empty={null} items={rows} />
    )
}

/** The way back after a take-over: hands the customer to the agent again (one neutral small button). */
export const StopHandBack = (props: StopAnswerBoxProps & { readonly conversationId: string }) => (
    <Cluster gap="inline">
        <Button
            intent="neutral"
            size="sm"
            isPending={props.isPending}
            onPress={() => props.act({ kind: "hand_back", conversationId: props.conversationId })}
        >
            {props.card.labels.handBack}
        </Button>
    </Cluster>
)

/** A leave request and who looks at it: its controls (none in a thread that cannot act) and whether the viewer is the owner. */
export interface StopApprovalProps {
    readonly card: TeamChatStopCardView
    readonly lines: TeamChatStopCardView["facts"]
    readonly controls: StopAnswerBoxProps | null
    readonly isOwner: boolean
}

/** A leave request: its lines, then Approve for the owner only (a manager sees Refuse and the line that the owner decides). */
export const StopApproval = (props: StopApprovalProps) => {
    const { card, controls } = props
    return (
        <Stack gap="row">
            <StopApprovalContent card={card} />
            <StopLinesList label={card.labels.approvalLabel} lines={props.lines} />
            {controls === null || card.verdicts.length === 0 ? null : (
                <Cluster gap="inline">
                    {props.isOwner && card.verdicts.includes("approve") ? (
                        <Button
                            intent="commit"
                            size="sm"
                            isPending={controls.isPending}
                            onPress={() => controls.act({ kind: "verdict", verdict: "approve" })}
                        >
                            {card.labels.approve}
                        </Button>
                    ) : null}
                    {card.verdicts.includes("refuse") ? (
                        <Button
                            intent="neutral"
                            size="sm"
                            isDisabled={controls.isPending}
                            onPress={() => controls.act({ kind: "verdict", verdict: "refuse" })}
                        >
                            {card.labels.refuse}
                        </Button>
                    ) : null}
                    {props.isOwner ? null : (
                        <Text size="xs" tone="muted">
                            {card.labels.ownerOnly}
                        </Text>
                    )}
                </Cluster>
            )}
        </Stack>
    )
}
