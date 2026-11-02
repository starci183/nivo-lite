import type { ReactNode } from "react"
import { Badge, Button, Cluster, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { OfficeExceptionView, OfficeThreadProps } from "@/modules/types"
import { QUOTE_CLASS_NAME } from "./classNames"

/** What one exception draws; the owner's controls come in as `form`. */
type OfficeExceptionCardProps = {
    readonly item: OfficeExceptionView
    readonly form: ReactNode
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["exception"]
}

const BADGE_TONES = { open: "warning", failed: "danger", done: "success", rejected: "danger" } as const

/**
 * A work item the flow could not finish alone, as a card from its department's agent: why it stopped, what is proposed, and, once
 * decided, the result. It stays in the thread as a record.
 */
export const OfficeExceptionCard = (props: OfficeExceptionCardProps) => {
    const { item, copy } = props
    return (
        <>
            <Cluster gap="inline">
                <Badge tone={BADGE_TONES[item.status]} isDot>
                    {item.badge}
                </Badge>
                <Badge tone="neutral">{item.department}</Badge>
                {item.reasonBadge === null ? null : <Badge tone="neutral">{item.reasonBadge}</Badge>}
            </Cluster>
            {renderOfficeExceptionCardProposal(item, copy)}
            {item.creditLine === null ? null : (
                <SurfaceCard ariaLabel={copy.reconcileCredit}>
                    <div className={QUOTE_CLASS_NAME}>
                        <Stack gap="identity">
                            <Text size="xs" tone="muted" isStrong>
                                {copy.reconcileCredit}
                            </Text>
                            <Text as="p" size="sm">
                                {item.creditLine}
                            </Text>
                            <Text as="p" size="sm" tone="muted">
                                {copy.reconcileWarning}
                            </Text>
                        </Stack>
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
                    <Text size="xs" tone="muted" isStrong>
                        {copy.exceptionResult}
                    </Text>
                    <Text as="p" size="sm">
                        {item.result}
                    </Text>
                    {item.decidedBasis === null ? null : (
                        <Text as="p" size="sm" isStrong>
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
                        {copy.exceptionOpenLead}
                    </Button>
                </div>
            )}
        </>
    )
}

/** One labelled block of the proposal card. */
type ProposalPartProps = { readonly label: string; readonly body: string; readonly isMuted: boolean }

/** Draws one labelled block. */
const ProposalPart = (props: ProposalPartProps) => (
    <>
        <Text size="xs" tone="muted" isStrong>
            {props.label}
        </Text>
        {props.isMuted ? (
            <Text as="p" size="sm" tone="muted">
                {props.body}
            </Text>
        ) : (
            <Text as="p" size="sm">
                {props.body}
            </Text>
        )}
    </>
)

/** Renders the OfficeExceptionCard proposal section: a drafted reply shows what the customer asked, then what NIVO would answer. */
const renderOfficeExceptionCardProposal = (
    item: NonNullable<OfficeExceptionCardProps["item"]>,
    copy: NonNullable<OfficeExceptionCardProps["copy"]>,
) => {
    const isReply = item.errorText === null && item.draft !== null
    const label = item.errorText === null ? copy.exceptionProposes : copy.exceptionErrorLabel
    return (
        <SurfaceCard ariaLabel={label}>
            <div className={QUOTE_CLASS_NAME}>
                <Stack gap="identity">
                    {isReply ? (
                        <>
                            <ProposalPart label={copy.exceptionAsked} body={item.summary} isMuted />
                            <ProposalPart label={copy.exceptionWillReply} body={item.draft ?? ""} isMuted={false} />
                        </>
                    ) : (
                        <ProposalPart label={label} body={item.errorText ?? item.summary} isMuted={false} />
                    )}
                </Stack>
            </div>
        </SurfaceCard>
    )
}
