import { PageContainer } from "@starci/grammar/common"
import { AuthorityGoals } from "@/components/blocks/AuthorityGoals"
import { AuthorityHead } from "@/components/blocks/AuthorityHead"
import { AuthorityLimits } from "@/components/blocks/AuthorityLimits"
import { AuthorityPolicies } from "@/components/blocks/AuthorityPolicies"
import { AuthorityScope } from "@/components/blocks/AuthorityScope"
import { AuthorityStaff } from "@/components/blocks/AuthorityStaff"
import { PAGE_CLASS } from "./classNames"

/** Draws the authority page: the heading, then the four sections in the order of the operating flow, then the optional staff. */
export const AuthorityPageBase = () => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            <AuthorityHead />
            <AuthorityGoals />
            <AuthorityPolicies />
            <AuthorityScope />
            <AuthorityLimits />
            <AuthorityStaff />
        </div>
    </PageContainer>
)
