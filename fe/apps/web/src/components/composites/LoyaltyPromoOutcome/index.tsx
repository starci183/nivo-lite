import { Alert, Heading, Quote, Stack, Text } from "@starci/grammar/common"

/** A settled campaign result, distinct from failures of reading it. */
interface LoyaltyPromoOutcomeProps {
    readonly result:
        | { readonly title: string; readonly recipients: string; readonly time: string; readonly draft: string }
        | undefined
    readonly failure: string | undefined
    readonly failureTitle: string
    readonly draftLabel: string
    readonly isLoading: boolean
}

/** The outcome cannot be drawn until the campaign answers; the submit control keeps its own pending box. */
export const LoyaltyPromoOutcome = (props: LoyaltyPromoOutcomeProps) => {
    if (props.isLoading) return null
    const result = props.result
    return (
        <>
            {props.failure === undefined ? null : (
                <Alert title={props.failureTitle} description={props.failure} tone="negative" />
            )}
            {result === undefined ? null : (
                <Stack gap="row">
                    <Heading level={3}>{result.title}</Heading>
                    <Text size="sm">{result.recipients}</Text>
                    {result.time === "" ? null : (
                        <Text size="xs" tone="muted">
                            {result.time}
                        </Text>
                    )}
                    <Quote source={props.draftLabel} text={result.draft} />
                </Stack>
            )}
        </>
    )
}
