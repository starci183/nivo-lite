import { Button, Form, Input, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { BAND_CLASS_NAME, LINK_FIELD_CLASS_NAME, LINK_ROW_CLASS_NAME } from "./classNames"

/** Copy and state the connected join form supplies. */
export interface WorkspaceJoinBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly linkLabel: string
        readonly placeholder: string
        readonly openLabel: string
        readonly failTitle: string
        readonly value: string
        readonly error?: string | undefined
    }
    readonly on: {
        readonly setValue: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the "I have an invitation link" form: paste the link, open its invitation page. */
export const WorkspaceJoinBase = (props: WorkspaceJoinBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2} composition="joined">
        <div className={BAND_CLASS_NAME}>
            <Form label={props.props.linkLabel} onSubmit={props.on.submit}>
                <Stack gap="row">
                    <Text size="sm" tone="muted">
                        {props.props.description}
                    </Text>
                    <div className={LINK_ROW_CLASS_NAME}>
                        <div className={LINK_FIELD_CLASS_NAME}>
                            <Input
                                id="ws-link"
                                name="link"
                                label={props.props.linkLabel}
                                placeholder={props.props.placeholder}
                                value={props.props.value}
                                onValueChange={props.on.setValue}
                            />
                        </div>
                        <Button type="submit" intent="neutral" isDisabled={props.props.value.trim() === ""}>
                            {props.props.openLabel}
                        </Button>
                    </div>
                    <FormNotice failTitle={props.props.failTitle} error={props.props.error} />
                </Stack>
            </Form>
        </div>
    </SurfaceCard>
)
