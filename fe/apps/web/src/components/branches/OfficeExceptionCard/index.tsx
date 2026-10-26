import type { ReactNode } from "react"
import { Badge, Button, SurfaceCard, Text } from "@starci/grammar/common"
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
            identity={item}
            aiLabel={text("aiBadge")}
            avatar={props.avatar}
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
            </div>
            {renderOfficeExceptionCardProposal(item, text)}
            {item.creditLine === null ? null : (
                <SurfaceCard ariaLabel={text("reconcileCredit")}>
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
                </SurfaceCard>
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
                    <Button intent="neutral" href={item.leadHref}>
                        {text("exceptionOpenLead")}
                    </Button>
                </div>
            )}
        </OfficeCardFrame>
    )
}

/** Renders the OfficeExceptionCard proposal section. */
const renderOfficeExceptionCardProposal = (
    item: NonNullable<OfficeExceptionCardProps["item"]>,
    text: NonNullable<OfficeExceptionCardProps["text"]>,
) => (
    <SurfaceCard ariaLabel={item.errorText === null ? text("exceptionProposes") : text("exceptionErrorLabel")}>
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
    </SurfaceCard>
)
