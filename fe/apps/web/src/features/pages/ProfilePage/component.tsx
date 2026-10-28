import { PageContainer } from "@starci/grammar/common"
import { AccountProfile } from "@/components/blocks/AccountProfile"
import { HomePageHeading } from "@/components/composites/HomePageHeading"
import { PAGE_CLASS_NAME } from "./classNames"

/** Copy the profile page supplies. */
export interface ProfilePageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
    }
}

/** Draws the signed-in person's profile: heading, then the connected picture and name card. */
export const ProfilePageBase = (props: ProfilePageBaseProps) => (
    <>
        <HomePageHeading {...props.props} />
        <PageContainer measure="product">
            <div className={PAGE_CLASS_NAME}>
                <AccountProfile />
            </div>
        </PageContainer>
    </>
)
