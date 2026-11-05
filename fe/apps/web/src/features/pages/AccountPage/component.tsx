import { Page, Stack } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { AccountSessions } from "@/components/blocks/AccountSessions"
import { AccountSignIn } from "@/components/blocks/AccountSignIn"

/** The header the account page supplies. */
export interface AccountPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/** Draws the account screen: the header with its two personal tabs, then the sign-in card and the signed-in devices. */
export const AccountPageBase = (props: AccountPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <Stack gap="region">
            <AccountSignIn />
            <AccountSessions />
        </Stack>
    </Page>
)
