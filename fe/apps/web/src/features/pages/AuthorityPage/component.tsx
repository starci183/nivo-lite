import { AuthorityGoals } from "@/components/blocks/AuthorityGoals"
import { AuthorityHead } from "@/components/blocks/AuthorityHead"
import { AuthorityLimits } from "@/components/blocks/AuthorityLimits"
import { AuthorityPolicies } from "@/components/blocks/AuthorityPolicies"
import { AuthorityScope } from "@/components/blocks/AuthorityScope"
import { AuthorityStaff } from "@/components/blocks/AuthorityStaff"

/** Draws the authority page: the heading, then the four sections in the order of the operating flow, then the optional staff. */
export const AuthorityPageBase = () => (
    <AuthorityHead>
        <AuthorityGoals />
        <AuthorityPolicies />
        <AuthorityScope />
        <AuthorityLimits />
        <AuthorityStaff />
    </AuthorityHead>
)
