import { Input, Stack, Textarea } from "@starci/grammar/common"

/** What the source step of the OpenAPI wizard draws and reports. */
type OpenApiSourceStepProps = {
    readonly isLoading: boolean
    readonly isDisabled: boolean
    readonly name: string
    readonly specUrl: string
    readonly specText: string
    readonly text: Readonly<
        Record<"name" | "nameHint" | "specUrl" | "specUrlHint" | "specText" | "specTextHint", string>
    >
    readonly onName: (value: string) => void
    readonly onSpecUrl: (value: string) => void
    readonly onSpecText: (value: string) => void
}

/** Step "source" of the OpenAPI wizard: the connection name, the spec link or the pasted spec. */
export const OpenApiSourceStep = (props: OpenApiSourceStepProps) => (
    <Stack gap="section">
        <Input
            id="oa-name"
            name="name"
            label={props.text.name}
            description={props.text.nameHint}
            isDisabled={props.isDisabled}
            value={props.name}
            onValueChange={props.onName}
            isLoading={props.isLoading}
        />
        <Input
            id="oa-url"
            name="specUrl"
            label={props.text.specUrl}
            description={props.text.specUrlHint}
            isDisabled={props.isDisabled}
            value={props.specUrl}
            onValueChange={props.onSpecUrl}
            isLoading={props.isLoading}
        />
        <Textarea
            id="oa-text"
            label={props.text.specText}
            description={props.text.specTextHint}
            rows={6}
            isDisabled={props.isDisabled}
            value={props.specText}
            onValueChange={props.onSpecText}
            isLoading={props.isLoading}
        />
    </Stack>
)
