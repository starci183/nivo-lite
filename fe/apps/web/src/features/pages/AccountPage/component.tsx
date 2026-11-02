import { Page, Stack } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { AccountEmail } from "@/components/blocks/AccountEmail"
import { AccountMethods } from "@/components/blocks/AccountMethods"
import { AccountPassword } from "@/components/blocks/AccountPassword"
import { AccountSessions } from "@/components/blocks/AccountSessions"

/** The header the account page supplies. */
export interface AccountPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/** Draws the account screen: heading, then the connected sign-in cards (email, password, sign-in methods, device sessions). */
export const AccountPageBase = (props: AccountPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <Stack gap="region">
            <AccountEmail />
            <AccountPassword />
            <AccountMethods />
            <AccountSessions />
        </Stack>
    </Page>
)
