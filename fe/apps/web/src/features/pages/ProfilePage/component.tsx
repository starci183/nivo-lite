import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { AccountProfile } from "@/components/blocks/AccountProfile"

/** The header the profile page supplies. */
export interface ProfilePageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/** Draws the signed-in person's profile: the header with its two personal tabs, then the connected picture and name card. */
export const ProfilePageBase = (props: ProfilePageBaseProps) => (
    <Page header={props.props.header} measure="reading">
        <AccountProfile />
    </Page>
)
