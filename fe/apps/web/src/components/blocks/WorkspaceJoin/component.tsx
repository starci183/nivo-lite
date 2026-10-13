import { Button, Form, Input, Region, SectionHeader, SurfaceCard } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { BAND_CLASS_NAME, LINK_FIELD_CLASS_NAME, LINK_ROW_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

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
        readonly error?: string
    }
    readonly on: {
        readonly setValue: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the "I have an invitation link" form: paste the link, open its invitation page. */
export const WorkspaceJoinBase = (props: WorkspaceJoinBaseProps) => (
    <Region labelledBy="ws-join" className={STACK_CLASS_NAME}>
        <SectionHeader id="ws-join" level={2} title={props.props.title} description={props.props.description} />
        <SurfaceCard ariaLabel={props.props.title} composition="joined">
            <div className={BAND_CLASS_NAME}>
                <Form label={props.props.linkLabel} onSubmit={props.on.submit}>
                    <div className={STACK_CLASS_NAME}>
                        <div className={LINK_ROW_CLASS_NAME}>
                            <div className={LINK_FIELD_CLASS_NAME}>
                                <Input
                                    id="ws-link"
                                    name="link"
                                    label={props.props.linkLabel}
                                    placeholder={props.props.placeholder}
                                    variant="secondary"
                                    value={props.props.value}
                                    onValueChange={props.on.setValue}
                                />
                            </div>
                            <Button type="submit" variant="outline" isDisabled={props.props.value.trim() === ""}>
                                {props.props.openLabel}
                            </Button>
                        </div>
                        <FormNotice failTitle={props.props.failTitle} error={props.props.error} />
                    </div>
                </Form>
            </div>
        </SurfaceCard>
    </Region>
)
