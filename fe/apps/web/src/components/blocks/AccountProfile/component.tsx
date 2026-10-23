import { Form, Input, SurfaceCard } from "@starci/grammar/common"
import { FormActions } from "@/components/composites/FormActions"
import { FORM_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected profile card supplies. */
export interface AccountProfileBaseProps {
    readonly props: {
        readonly title: string
        readonly nameLabel: string
        readonly nameHint: string
        readonly saveLabel: string
        readonly failTitle: string
        readonly name: string
        readonly isPending: boolean
        readonly isLoading: boolean
        readonly error?: string | undefined
        readonly done?: string
    }
    readonly on: { readonly setName: (value: string) => void; readonly submit: () => void }
}

/** Draws the display-name card without reading copy, navigation or database state. */
export const AccountProfileBase = (props: AccountProfileBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
            <div className={FORM_CLASS_NAME}>
                <Input
                    id="account-name"
                    name="name"
                    label={props.props.nameLabel}
                    hint={props.props.nameHint}
                    variant="secondary"
                    isRequired
                    isDisabled={props.props.isPending}
                    isSkeleton={props.props.isLoading}
                    value={props.props.name}
                    onValueChange={props.on.setName}
                />
                <FormActions
                    failTitle={props.props.failTitle}
                    error={props.props.error}
                    done={props.props.done}
                    submitLabel={props.props.saveLabel}
                    isPending={props.props.isPending}
                    isSkeleton={props.props.isLoading}
                />
            </div>
        </Form>
    </SurfaceCard>
)
