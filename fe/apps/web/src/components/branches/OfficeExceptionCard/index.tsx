import type { ReactNode } from "react"
import { Badge, Button, Text } from "@starci/grammar/common"
import { OfficeCardFrame } from "@/components/leaves/OfficeCardFrame"
import type { OfficeExceptionView, OfficeText } from "@/modules/types"
import { QUOTE_CLASS_NAME, STATUS_CLASS_NAME, TEXT_CLASS_NAME } from "./classNames"

/** What one exception draws; the owner's controls come in as `form`. */
type OfficeExceptionCardProps = {
    readonly item: OfficeExceptionView
    readonly avatar: ReactNode
    readonly form: ReactNode
    readonly text: OfficeText
}

const BADGE_TONES = { open: "warning", failed: "danger", done: "success", rejected: "danger" } as const

/**
 * A work item the flow could not finish alone, as a card from its department's agent: why it stopped, what is proposed, and, once
 * decided, the result. It stays in the thread as a record.
 */
export const OfficeExceptionCard = (props: OfficeExceptionCardProps) => {
    const { item, text } = props
    return (
        <OfficeCardFrame
            id={item.anchor}
            author={item.author}
            avatar={props.avatar}
            status={item.isAi ? <Badge tone="neutral">{text("aiBadge")}</Badge> : undefined}
            meta={item.time}
            label={item.title}
            isHighlight={item.isFocused}
            head={
                <div className={TEXT_CLASS_NAME}>
                    <Text weight="semibold">{item.title}</Text>
                    {item.hint === null ? null : (
                        <Text size="sm" tone="muted">
                            {item.hint}
                        </Text>
                    )}
                </div>
            }
        >
            <div className={STATUS_CLASS_NAME}>
                <Badge tone={BADGE_TONES[item.status]} isDot>
                    {item.badge}
                </Badge>
                <Badge tone="neutral">{item.department}</Badge>
                {item.reasonBadge === null ? null : <Badge tone="neutral">{item.reasonBadge}</Badge>}
                {item.isSimulated ? <Badge tone="neutral">{text("simulatedTag")}</Badge> : null}
            </div>
            <div className={QUOTE_CLASS_NAME}>
                <Text size="xs" tone="muted" weight="medium">
                    {item.errorText === null ? text("exceptionProposes") : text("exceptionErrorLabel")}
                </Text>
                <Text as="p" size="sm">
                    {item.errorText ?? item.summary}
                </Text>
                {item.draft === null || item.errorText !== null ? null : (
                    <Text as="p" size="sm" tone="muted">
                        {item.draft}
                    </Text>
                )}
            </div>
            {item.creditLine === null ? null : (
                <div className={QUOTE_CLASS_NAME}>
                    <Text size="xs" tone="muted" weight="medium">
                        {text("reconcileCredit")}
                    </Text>
                    <Text as="p" size="sm">
                        {item.creditLine}
                    </Text>
                    <Text as="p" size="sm" tone="muted">
                        {text("reconcileWarning")}
                    </Text>
                </div>
            )}
            {props.form}
            {item.heldLine === null ? null : (
                <Text size="xs" tone="muted">
                    {item.heldLine}
                </Text>
            )}
            {item.result === null ? null : (
                <div>
                    <Text size="xs" tone="muted" weight="medium">
                        {text("exceptionResult")}
                    </Text>
                    <Text as="p" size="sm">
                        {item.result}
                    </Text>
                    {item.decidedBasis === null ? null : (
                        <Text as="p" size="sm" weight="medium">
                            {item.decidedBasis}
                        </Text>
                    )}
                </div>
            )}
            {item.footer === null ? null : (
                <Text size="xs" tone="muted">
                    {item.footer}
                </Text>
            )}
            {item.leadHref === null ? null : (
                <div>
                    <Button variant="ghost" href={item.leadHref}>
                        {text("exceptionOpenLead")}
                    </Button>
                </div>
            )}
        </OfficeCardFrame>
    )
}
