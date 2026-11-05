import { Alert, EmptyNotice, Section, Stack, Text } from "@starci/grammar/common"

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
        readonly gateLine?: string
        readonly alwaysAskLine?: string
        readonly autoSendLine?: string
    }
    readonly modeLine?: string
    readonly trustOffer?: AutomationTrustOffer
    readonly guardrails?: { readonly title: string; readonly items: ReadonlyArray<string> }
}

/** The authority, send policy, opt-in and invariant guardrails stay under their named regions. */
export const AutomationGate = (props: AutomationGateProps) => (
    <Section title={props.sectionLabel} headingLevel={3}>
        {props.authority === undefined ? null : (
            <Stack gap="inline">
                {props.authority.gateLine === undefined ? null : <Text size="sm">{props.authority.gateLine}</Text>}
                {props.authority.alwaysAskLine === undefined ? null : (
                    <Text size="sm">{props.authority.alwaysAskLine}</Text>
                )}
                {props.authority.autoSendLine === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {props.authority.autoSendLine}
                    </Text>
                )}
            </Stack>
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
            <Section
                kind="list"
                title={props.guardrails.title}
                headingLevel={4}
                items={props.guardrails.items.map((item) => ({ id: item, title: item }))}
                empty={<EmptyNotice message={props.guardrails.title} />}
            />
        )}
    </Section>
)
