import { Badge, Button, Text, TextAction } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { OfficeMemberRowView } from "@/modules/types"
import {
    ACTIONS_CLASS_NAME,
    CHIP_CLASS_NAME,
    CONTENT_CLASS_NAME,
    NAME_CLASS_NAME,
    NAME_LINE_CLASS_NAME,
    ROW_CLASS_NAME,
    TEXT_CLASS_NAME,
} from "./classNames"

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
    <div className={ROW_CLASS_NAME}>
        {props.avatar}
        <div className={CONTENT_CLASS_NAME}>
            <div className={TEXT_CLASS_NAME}>
                <div className={NAME_LINE_CLASS_NAME}>
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
                    {props.member.presence === null ? null : (
                        <div className={CHIP_CLASS_NAME}>
                            <Badge tone="success" isDot>
                                {props.member.presence}
                            </Badge>
                        </div>
                    )}
                </div>
                <Text size="sm" tone="muted" overflow="truncate">
                    {props.member.detail}
                </Text>
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
                <div className={ACTIONS_CLASS_NAME}>
                    {props.member.mention === null ? null : (
                        <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => props.onMention(props.member.mention ?? "")}
                        >
                            {props.mentionLabel}
                        </Button>
                    )}
                    {props.member.chatHref === null ? null : (
                        <Button variant="secondary" size="sm" href={props.member.chatHref}>
                            {props.chatLabel}
                        </Button>
                    )}
                </div>
            )}
        </div>
    </div>
)
