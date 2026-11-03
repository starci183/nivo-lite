"use client"

import { useCallback } from "react"
import { useQueryDashboardSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"

import type {
    GovernanceWorkStatus,
    GovernanceWorkReason,
    GovernanceDecidedPath,
    GovernanceDeciderKind,
    GovernanceDecisionOutcome,
} from "@/modules/api/graphql/__generated__/graphql"

type UseOverviewDataResult = {
    dashboard:
        | {
              since7: string
              agents: Array<{
                  id: string
                  module: string
                  name: string
                  handle: string
                  role: string
                  instructions: string
                  knowledge: string
                  greeting: string
                  approvalRule: string
                  status: string
                  createdAt: string
              }>
              events: Array<{
                  id: string
                  leadId: string | null
                  kind: string
                  actor: string
                  summary: string
                  evidence: string | null
                  createdAt: string
              }>
              leads: Array<{
                  id: string
                  stage: string
                  createdAt: string
                  contactName: string | null
                  company: string | null
              }>
              pending: Array<{
                  id: string
                  responsibilityId: string
                  leadId: string | null
                  createdAt: string
              }>
              responsibilities: Array<{
                  id: string
                  leadId: string
                  title: string
                  ownerKind: string
                  ownerAgentId: string | null
                  ownerName: string
                  nextAction: string
                  dueAt: string | null
                  status: string
                  createdAt: string
                  lead: {
                      id: string
                      contactName: string
                      company: string
                      stage: string
                  }
              }>
              promo: {
                  isFoundingMember: boolean
                  hasCustomerConversation: boolean
                  hasLeadConversation: boolean
                  approvedCount: number
                  hasWon: boolean
                  invoiceApproved: boolean
                  chatbot: {
                      id: string
                      knowledge: string
                  } | null
                  websiteLeads: Array<{
                      id: string
                      createdAt: string
                  }>
                  firstEvents: Array<{
                      leadId: string
                      at: string
                  }>
              }
              exceptions: Array<{
                  id: string
                  leadId: string | null
                  department: string
                  action: string
                  status: string
                  reason: string | null
                  error: string | null
                  summary: string | null
                  contact: string | null
                  customer: string | null
                  executionId: string | null
                  assignedStaffName: string | null
                  createdAt: string
                  lead: {
                      id: string
                      contactName: string
                      company: string
                      channel: string
                  } | null
              }>
              governance: {
                  pendingWithoutWork: number
                  authority: {
                      goalRevenueVnd: number | null
                      goalNewCustomers: number | null
                      goalFirstReplyMinutes: number | null
                  } | null
                  leads: Array<{
                      id: string
                      contactName: string | null
                      company: string | null
                      stage: string
                      createdAt: string
                  }>
                  orders: Array<{
                      id: string
                      leadId: string | null
                      orderNo: string | null
                      items: string | null
                      amountVnd: number | null
                      status: string
                  }>
                  invoices: Array<{
                      id: string
                      orderId: string | null
                      leadId: string | null
                      invoiceNo: string | null
                      amountVnd: number | null
                      status: string
                  }>
                  transactions: Array<{
                      id: string
                      invoiceId: string | null
                      payer: string | null
                      reference: string | null
                      amountVnd: number | null
                      status: string
                  }>
                  work: Array<{
                      id: string
                      leadId: string | null
                      department: string
                      status: GovernanceWorkStatus
                      reason: GovernanceWorkReason | null
                      decidedPath: GovernanceDecidedPath | null
                      createdAt: string
                      updatedAt: string
                      completedAt: string | null
                      summary: string | null
                      contact: string | null
                      customer: string | null
                  }>
                  decisions7: Array<{
                      workItemId: string | null
                      leadId: string | null
                      deciderKind: GovernanceDeciderKind
                      outcome: GovernanceDecisionOutcome
                      createdAt: string
                  }>
                  recent: Array<{
                      id: string
                      workItemId: string | null
                      leadId: string | null
                      leadName: string | null
                      department: string
                      action: string
                      decidedBy: string
                      deciderKind: string
                      outcome: string
                      reason: string | null
                      note: string | null
                      createdAt: string
                  }>
              }
          }
        | undefined
    failed: boolean
    retry: () => undefined
    displayName: string | undefined
}

/**
 * The dashboard of the active workspace and the signed-in person's name in it, read through the shared SWR cache: every region of
 * the overview calls this and they all share one request. `dashboard` is undefined until the first answer.
 */
export const useOverviewData = (): UseOverviewDataResult => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryDashboardSwr(activeWorkspaceId)
    const workspaces = useQueryMyWorkspacesSwr()
    const { mutate } = query
    const retry = useCallback((): undefined => void mutate(), [mutate])
    return {
        dashboard: query.data,
        failed: query.data === undefined && query.error !== undefined,
        retry,
        displayName: workspaces.data?.find((entry) => entry.workspace.id === activeWorkspaceId)?.member.displayName,
    }
}
