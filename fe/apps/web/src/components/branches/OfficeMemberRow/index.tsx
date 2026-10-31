import { Badge, Cluster, IconButton, ItemActions, Text, TextAction, Tooltip } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeMemberRowView } from "@/modules/types"
import { CHIP_CLASS_NAME, CONTENT_CLASS_NAME, LINE_CLASS_NAME, NAME_CLASS_NAME, TEXT_CLASS_NAME } from "./classNames"

/** One member of the info panel, with its words. */
type OfficeMemberRowProps = {
    /** The member's mark, drawn by the caller. */
    readonly avatar: ReactNode
    readonly member: OfficeMemberRowView
    readonly youLabel: string
    readonly mentionLabel: string
    readonly chatLabel: string
    readonly onMention: (handle: string) => void
}

/** One member: the avatar beside the name with its chips and the lines under it, then the quick actions as one button row. */
export const OfficeMemberRow = (props: OfficeMemberRowProps) => (
    <Cluster gap="row" wrap={false}>
        {props.avatar}
        <div className={CONTENT_CLASS_NAME}>
            <Cluster gap="inline" wrap={false}>
            <div className={TEXT_CLASS_NAME}>
                <div className={LINE_CLASS_NAME}>
                    <Cluster gap="inline">
                        <div className={NAME_CLASS_NAME}>
                            <Text weight="medium" overflow="truncate">
                                {props.member.name}
                            </Text>
                        </div>
                        {props.member.isMe ? (
                            <div className={CHIP_CLASS_NAME}>
                                <Badge tone="accent">{props.youLabel}</Badge>
                            </div>
                        ) : null}
                    </Cluster>
                </div>
                <div className={LINE_CLASS_NAME}>
                    <Cluster gap="inline" wrap={false}>
                        {props.member.presence === null ? null : (
                            <div className={CHIP_CLASS_NAME}>
                                <Badge tone="success" isDot>
                                    {props.member.presence}
                                </Badge>
                            </div>
                        )}
                        <Text size="sm" tone="muted" overflow="truncate">
                            {props.member.detail}
                        </Text>
                    </Cluster>
                </div>
                {props.member.seen === null ? null : (
                    <Text size="xs" tone="muted" overflow="truncate">
                        {props.member.seen}
                    </Text>
                )}
                {props.member.note === null ? null : (
                    <Text size="xs" tone="muted">
                        {props.member.note}
                    </Text>
                )}
                {props.member.noteAction === null ? null : (
                    <TextAction size="xs" href={props.member.noteAction.href}>
                        {props.member.noteAction.label}
                    </TextAction>
                )}
            </div>
            {props.member.mention === null && props.member.chatHref === null ? null : (
                <ItemActions>
                    <Cluster gap="identity" wrap={false}>
                        {props.member.mention === null ? null : (
                            <Tooltip content={props.mentionLabel}>
                                <IconButton
                                    intent="neutral"
                                    source={nivoIconSource("mention", "leading")}
                                    label={props.mentionLabel}
                                    onPress={() => props.onMention(props.member.mention ?? "")}
                                />
                            </Tooltip>
                        )}
                        {props.member.chatHref === null ? null : (
                            <Tooltip content={props.chatLabel}>
                                <IconButton
                                    intent="neutral"
                                    source={nivoIconSource("chat", "leading")}
                                    label={props.chatLabel}
                                    href={props.member.chatHref}
                                />
                            </Tooltip>
                        )}
                    </Cluster>
                </ItemActions>
            )}
            </Cluster>
        </div>
    </Cluster>
)
