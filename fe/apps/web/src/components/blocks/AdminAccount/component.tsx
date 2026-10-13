import { Text } from "@starci/grammar/common"

/** The signed-in platform admin the top bar names. */
export interface AdminAccountBaseProps {
    readonly props: {
        readonly email: string
    }
}

/** Draws who is signed in to the console. */
export const AdminAccountBase = (props: AdminAccountBaseProps) => (
    <Text size="sm" tone="muted">
        {props.props.email}
    </Text>
)
