import { PageContainer } from "@starci/grammar/common"
import { AccountEmail } from "@/components/blocks/AccountEmail"
import { AccountMethods } from "@/components/blocks/AccountMethods"
import { AccountPassword } from "@/components/blocks/AccountPassword"
import { AccountProfile } from "@/components/blocks/AccountProfile"
import { AccountSessions } from "@/components/blocks/AccountSessions"
import { HomePageHeading } from "@/components/composites/HomePageHeading"
import { PAGE_CLASS_NAME } from "./classNames"

/** Copy the account page supplies. */
export interface AccountPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
    }
}

/** Draws the account screen: heading, then the connected cards (profile, email, password, sign-in methods, device sessions). */
export const AccountPageBase = (props: AccountPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <HomePageHeading {...props.props} />
            <AccountProfile />
            <AccountEmail />
            <AccountPassword />
            <AccountMethods />
            <AccountSessions />
        </div>
    </PageContainer>
)
