import { Button, Form, Heading, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { ACTIONS_CLASS_NAME, HEAD_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected create form supplies. */
export interface WorkspaceCreateBaseProps {
    readonly props: {
        readonly title: string
        /** The question the card opens with (the page's h1) and the line under it. */
        readonly heading: string
        readonly description: string
        readonly nameLabel: string
        readonly nameHint: string
        /** The business type picker: its label, the offered types and the chosen one. */
        readonly industryLabel: string
        readonly industries: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly industry: string
        /** The owner's own words, asked for only when the type is `other`. */
        readonly isOtherIndustry: boolean
        readonly otherIndustryLabel: string
        readonly otherIndustry: string
        readonly otherIndustryError?: string | undefined
        readonly submitLabel: string
        readonly cancelLabel: string
        readonly cancelHref: string
        readonly failTitle: string
        readonly name: string
        readonly isPending: boolean
        readonly error?: string | undefined
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly setIndustry: (value: string | null) => void
        readonly setOtherIndustry: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the form that names a new workspace: the card opens with the page's question, then the name and the actions. */
export const WorkspaceCreateBase = (props: WorkspaceCreateBaseProps) => {
    const { props: form, on } = props

    return (
        <SurfaceCard ariaLabel={form.title} measure="form">
            <Form label={form.title} onSubmit={on.submit} isPending={form.isPending}>
                <div className={STACK_CLASS_NAME}>
                    <div className={HEAD_CLASS_NAME}>
                        <Heading level={1}>{form.heading}</Heading>
                        <Text tone="muted">{form.description}</Text>
                    </div>
                    <Input
                        id="workspace-name"
                        name="name"
                        label={form.nameLabel}
                        description={form.nameHint}
                        isRequired
                        isDisabled={form.isPending}
                        value={form.name}
                        onValueChange={on.setName}
                    />
                    <Select
                        name="businessType"
                        label={form.industryLabel}
                        options={form.industries}
                        value={form.industry}
                        isDisabled={form.isPending}
                        onValueChange={on.setIndustry}
                    />
                    {form.isOtherIndustry ? (
                        <Input
                            id="workspace-industry"
                            name="customIndustry"
                            label={form.otherIndustryLabel}
                            isRequired
                            isDisabled={form.isPending}
                            value={form.otherIndustry}
                            isError={form.otherIndustryError !== undefined}
                            errorMessage={form.otherIndustryError}
                            onValueChange={on.setOtherIndustry}
                        />
                    ) : null}
                    <FormNotice failTitle={form.failTitle} error={form.error} />
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button type="submit" intent="commit" isPending={form.isPending}>
                            {form.submitLabel}
                        </Button>
                        <Button intent="neutral" href={form.cancelHref} isDisabled={form.isPending}>
                            {form.cancelLabel}
                        </Button>
                    </div>
                </div>
            </Form>
        </SurfaceCard>
    )
}
