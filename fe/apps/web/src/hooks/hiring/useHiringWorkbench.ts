"use client"

import type { SlotRead, DataSlot } from "@/modules/types"

import { useMemo } from "react"
import { EMPTY_BOARD, toHiringWorkbenchData } from "@/hooks/hiringMap"
import { useQueryHiringWorkbenchSwr } from "@/hooks/swr"
import { isForbiddenFailure } from "@/modules/failure"
import { readError } from "@/hooks/workspaceread"
import { slotOfSwr } from "@/hooks/slot"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"

/** The view `useHiringWorkbench` returns. */
export interface HiringWorkbenchViewShape {
    read: SlotRead<HiringWorkbenchData | undefined>
    slot: DataSlot<HiringWorkbenchData | undefined>
    board: HiringWorkbenchData
    hasBoard: boolean
    isLoading: boolean
    isFailed: boolean
    isForbidden: boolean
    reload: () => Promise<
        | {
              meUserId: string
              nowIso: string
              origin: string
              waitingApprovals: number
              candidates: Array<{
                  availability: string
                  conversationId: string | null
                  createdAt: string
                  cvMime: string | null
                  cvName: string | null
                  cvPath: string | null
                  cvSize: number | null
                  email: string
                  id: string
                  jobId: string
                  name: string
                  notes: string
                  phone: string
                  rejectedReason: string | null
                  score: number | null
                  scoreLabel: string | null
                  scoreSummary: string | null
                  screenedAt: string | null
                  source: string
                  staffId: string | null
                  stage: string
                  stageChangedAt: string
                  workspaceId: string
                  answers: Array<{
                      answer: string
                      question: string
                      questionId: string
                  }>
                  scoreReasons: Array<{
                      criterion: string
                      note: string
                      status: string
                  }>
              }>
              figures: {
                  interviewsWeek: number
                  offersSent: number
                  offersWaiting: number
                  openRoles: number
                  pipeline: number
                  totalRoles: number
              }
              interviews: Array<{
                  candidateId: string
                  createdAt: string
                  durationMin: number
                  id: string
                  interviewerName: string
                  interviewerUserId: string | null
                  jobId: string
                  location: string
                  mode: string
                  note: string
                  reminderSentAt: string | null
                  slotEnd: string | null
                  slotStart: string | null
                  status: string
                  token: string
                  workItemId: string | null
                  workspaceId: string
                  proposedSlots: Array<{
                      end: string
                      start: string
                  }>
              }>
              jobs: Array<{
                  adVariants: unknown
                  channels: Array<string>
                  closesAt: string | null
                  createdAt: string
                  description: string
                  employmentType: string
                  headcount: number
                  id: string
                  location: string
                  payMaxVnd: number | null
                  payMinVnd: number | null
                  payUnit: string
                  position: string
                  publicUrl: string | null
                  schedule: string
                  slug: string
                  status: string
                  title: string
                  updatedAt: string
                  workspaceId: string
                  questions: Array<{
                      choices: Array<string>
                      expectChoices: Array<string> | null
                      expectNumber: number | null
                      expectYesNo: string | null
                      id: string
                      required: boolean
                      text: string
                      type: string
                  }>
                  requirements: {
                      availability: Array<string>
                      experienceNote: string
                      experienceYears: number | null
                      mustHave: Array<string>
                      niceToHave: Array<string>
                      skills: Array<string>
                  }
              }>
              members: Array<{
                  name: string
                  role: string
                  userId: string
                  windows: Array<{
                      endMin: number
                      startMin: number
                      weekday: number
                  }>
              }>
              offers: Array<{
                  candidateId: string
                  createdAt: string
                  draft: string
                  expiresAt: string | null
                  id: string
                  jobId: string
                  respondedAt: string | null
                  sentAt: string | null
                  sentVia: string | null
                  status: string
                  token: string
                  workItemId: string | null
                  workspaceId: string
                  terms: {
                      note: string
                      pay: string
                      probation: string
                      startDate: string
                      title: string
                  }
              }>
              onboarding: Array<{
                  candidateId: string
                  done: boolean
                  doneAt: string | null
                  id: string
                  sort: number
                  title: string
              }>
              settings: {
                  adTone: string
                  applyConsentText: string
                  autoCloseWhenFilled: boolean
                  notifyNewCandidate: boolean
                  publicSlug: string
                  remindInterview: boolean
                  retentionDays: number
                  workspaceId: string
              }
          }
        | undefined
    >
}

/**
 * The Hiring workbench through SWR, shared by every tab block (one cache entry). `board` is the empty board until the first read
 * lands, so a block can always draw; `isLoading`, `isFailed` and `isForbidden` (not an owner or a manager) say why it is empty.
 */
export const useHiringWorkbench = (isActive = true): HiringWorkbenchViewShape => {
    const swrRead = useQueryHiringWorkbenchSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const mapped = useMemo(() => (data === undefined ? undefined : toHiringWorkbenchData(data)), [data])
    const read: SlotRead<typeof mapped> = {
        data: mapped,
        error: swrRead.error,
        isLoading: swrRead.isLoading,
        isValidating: swrRead.isValidating,
    }
    return {
        read,
        slot: slotOfSwr(read),
        board: mapped ?? EMPTY_BOARD,
        hasBoard: mapped !== undefined,
        isLoading,
        isFailed: error !== undefined,
        isForbidden: isForbiddenFailure(error),
        reload: () => swrRead.mutate(),
    }
}
