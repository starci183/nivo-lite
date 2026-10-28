import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { AccountProfile } from "@/components/blocks/AccountProfile"
import { PAGE_CLASS_NAME } from "./classNames"

/** The header the profile page supplies. */
export interface ProfilePageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/** Draws the signed-in person's profile: heading, then the connected picture and name card. */
export const ProfilePageBase = (props: ProfilePageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <div className={PAGE_CLASS_NAME}>
            <AccountProfile />
        </div>
    </Page>
)
