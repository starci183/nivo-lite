import { Alert, Divider, Heading, List, ListItem, Region, Text } from "@starci/grammar/common"
import { FACTS_CLASS, SECTION_CLASS } from "./classNames"

/** The offer to let an automation send by itself. */
type AutomationTrustOffer = {
    readonly title: string
    readonly yesLabel: string
    readonly noLabel: string
    readonly onAnswer: (accept: boolean) => void
}

/** What the gate panel shows, already in the reader language. */
type AutomationGateProps = {
    readonly sectionLabel: string
    /** The heading and lines about the message under the owner's authority; absent when the template sends nothing to a customer. */
    readonly authority?: {
        readonly title: string
        readonly gateLine?: string
        readonly alwaysAskLine?: string
        readonly autoSendLine?: string
    }
    readonly modeLine?: string
    readonly trustOffer?: AutomationTrustOffer
    readonly guardrails?: { readonly title: string; readonly items: ReadonlyArray<string> }
}

/** What happens to the message under the owner's authority, how it is written, and what NIVO always keeps. */
export const AutomationGate = (props: AutomationGateProps) => (
    <>
        <Divider semantics="presentation" />
        <Region className={SECTION_CLASS} label={props.sectionLabel}>
            {props.authority === undefined ? null : (
                <div className={FACTS_CLASS}>
                    <Heading level={3}>{props.authority.title}</Heading>
                    {props.authority.gateLine === undefined ? null : <Text size="sm">{props.authority.gateLine}</Text>}
                    {props.authority.alwaysAskLine === undefined ? null : (
                        <Text size="sm">{props.authority.alwaysAskLine}</Text>
                    )}
                    {props.authority.autoSendLine === undefined ? null : (
                        <Text size="sm" tone="muted">
                            {props.authority.autoSendLine}
                        </Text>
                    )}
                </div>
            )}
            {props.modeLine === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.modeLine}
                </Text>
            )}
            {props.trustOffer === undefined ? null : (
                <Alert
                    title={props.trustOffer.title}
                    tone="informative"
                    action={{ label: props.trustOffer.yesLabel, onAction: () => props.trustOffer?.onAnswer(true) }}
                    dismissLabel={props.trustOffer.noLabel}
                    onDismiss={() => props.trustOffer?.onAnswer(false)}
                />
            )}
            {props.guardrails === undefined ? null : (
                <div className={FACTS_CLASS}>
                    <Heading level={4}>{props.guardrails.title}</Heading>
                    <List className={FACTS_CLASS} label={props.guardrails.title}>
                        {props.guardrails.items.map((item) => (
                            <ListItem key={item}>
                                <Text size="sm">{item}</Text>
                            </ListItem>
                        ))}
                    </List>
                </div>
            )}
        </Region>
    </>
)
