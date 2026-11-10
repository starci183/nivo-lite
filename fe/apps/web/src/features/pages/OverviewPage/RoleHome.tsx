"use client"

import { OverviewDashboard } from "@/components/blocks/OverviewDashboard"
import { StaffHome } from "@/components/blocks/StaffHome"
import { useMember, isManager } from "@/hooks/member"

/** The home of the workspace by role: owners and managers read the business dashboard, staff their own day. */
export const RoleHome = () => (isManager(useMember()) ? <OverviewDashboard /> : <StaffHome />)
