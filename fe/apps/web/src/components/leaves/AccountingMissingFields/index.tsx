import { Input, Stack, Text } from "@starci/grammar/common"

/** One data field the person fills in. */
interface AccountingMissingField {
    readonly name: string
    readonly label: string
    readonly value: string
}

/** The fields NIVO is missing for one question, under their lead-in line. */
interface AccountingMissingFieldsProps {
    readonly id: string
    readonly label: string
    readonly fields: ReadonlyArray<AccountingMissingField>
    readonly isBusy: boolean
    readonly onChange: (name: string, value: string) => void
}

/** The missing proposal inputs, stacked above the decision buttons. */
export const AccountingMissingFields = (props: AccountingMissingFieldsProps) => (
    <Stack gap="row">
        <Text size="sm" weight="medium">
            {props.label}
        </Text>
        {props.fields.map((field) => (
            <Input
                key={field.name}
                id={`${props.id}-${field.name}`}
                name={field.name}
                label={field.label}
                value={field.value}
                isRequired
                isDisabled={props.isBusy}
                onValueChange={(value) => props.onChange(field.name, value)}
            />
        ))}
    </Stack>
)
