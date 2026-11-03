"use client"
import { whenSelected } from "@/modules/utils"
import type { HiringSelectedViewInput } from "./hiringWorkbench.shared"

import { useHiringJobsView } from "./useHiringJobsView"
import { useHiringPipelineView } from "./useHiringPipelineView"
import { useHiringInterviewsView } from "./useHiringInterviewsView"
import { useHiringOffersView } from "./useHiringOffersView"
import { useHiringOnboardingView } from "./useHiringOnboardingView"
import type { HiringWorkbenchCopy, HiringJobValues, HiringQuestionValues, FieldOf } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { AdView } from "@/hooks/hiringWire"
import type { Dispatch, SetStateAction } from "react"

/** The view `useHiringBoardViews` returns. */
export interface HiringBoardViewsView {
    props: {
        jobs: {
            copy: HiringWorkbenchCopy
            fact: string
            rows: {
                id: string
                title: string
                statusLabel: string
                statusTone: BadgeTone
                facts: string
                counts: string
                publicUrl: string | null
                copyLabel: string | null
                transitions: {
                    to: string
                    label: string
                    isPrimary: boolean
                }[]
            }[]
            isBusy: boolean
            error: string | null
            isEditorOpen: boolean
            editor: {
                copy: HiringWorkbenchCopy
                isNew: boolean
                values: HiringJobValues
                questions: {
                    question: HiringQuestionValues
                    numberLabel: string
                }[]
                employmentOptions: {
                    id: string
                    label: string
                }[]
                payUnitOptions: {
                    id: string
                    label: string
                }[]
                questionTypeOptions: {
                    id: string
                    label: string
                }[]
                channelOptions: {
                    id: string
                    label: string
                }[]
                canSave: boolean
                canAddQuestion: boolean
                isBusy: boolean
                error: string | null
            }
            isAdOpen: boolean
            ad: {
                copy: HiringWorkbenchCopy
                title: string
                ads: AdView | null
                meta: string | null
                publicUrl: string | null
                publicLinkLabel: string | null
                kindLabels: {
                    facebook: string
                    zalo: string
                    topcv: string
                }
                copiedId: string | null
                isBusy: boolean
                error: string | null
            }
        }
        pipeline: {
            copy: {
                title: string
                jobLabel: string
                moveFailed: string
                dismissLabel: string
                emptyTitle: string
                emptyBody: string
                boardLabel: string
                laneEmpty: string
                openLabel: string
                moveToLabel: string
                movePlaceholder: string
            }
            jobId: string
            jobOptions: {
                id: string
                label: string
            }[]
            lanes: {
                stage: string
                label: string
                count: string
                cards: {
                    id: string
                    name: string
                    scoreLabel: string
                    scoreTone: BadgeTone
                    meta: string
                    suggestion: string | null
                    moveOptions: {
                        id: string
                        label: string
                    }[]
                }[]
            }[]
            hasNoCandidates: boolean
            withdrawnNote: string | null
            dragId: string | null
            overStage: string | null
            isBusy: boolean
            error: string | null
            isRejectOpen: boolean
            reject: {
                copy: {
                    title: string
                    closeLabel: string
                    hint: string
                    failed: string
                    reasonLabel: string
                    kept: string
                    cancelLabel: string
                    confirmLabel: string
                }
                reason: string
                canConfirm: boolean
                isBusy: boolean
                error: string | null
            }
        }
        interviews: {
            copy: HiringWorkbenchCopy
            weekLabel: string
            isThisWeek: boolean
            days: {
                key: string
                label: string
                isToday: boolean
                items: {
                    id: string
                    candidateId: string
                    title: string
                    meta: string
                    isConfirmed: boolean
                }[]
            }[]
            invitations: {
                title: string
                badge: string
                meta: string
                proposed: string
                note: string | null
                copyLabel: string
                id: string
                candidateId: string
                isConfirmed: boolean
            }[]
            invitationsFact: string
            isBusy: boolean
            error: string | null
        }
        offers: {
            copy: HiringWorkbenchCopy
            approveLabel: string | null
            decisionsHref: "/decisions"
            fact: string
            rows: {
                id: string
                candidateId: string
                name: string
                statusLabel: string
                statusTone: BadgeTone
                meta: string
                sent: string | null
                isWaiting: boolean
                copyLabel: string | null
                canCancel: boolean
            }[]
            isBusy: boolean
            error: string | null
        }
        onboarding: {
            copy: {
                title: string
                emptyTitle: string
                emptyBody: string
                errorTitle: string
                dismissLabel: string
                hasStaffLabel: string
                createStaffLabel: string
                progressLabel: string
            }
            people: {
                id: string
                name: string
                job: string
                contact: string
                hasStaff: boolean
                done: number
                steps: {
                    id: string
                    title: string
                    isDone: boolean
                }[]
            }[]
            isBusy: boolean
            error: string | null
        }
    }
    on: {
        jobs: {
            list: {
                create: () => void
                edit: (id: string) => void
                openAd: Dispatch<SetStateAction<string | null>>
                copy: (id: string) => void
                transition: (id: string, to: string) => void
            }
            editor: {
                text: (name: FieldOf<HiringJobValues, string>, value: string) => void
                number: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
                list: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) => void
                patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) => void
                addQuestion: () => void
                removeQuestion: (index: number) => void
                save: () => void
                close: () => void
            }
            ad: {
                generate: () => void
                copy: (id: string, text: string) => void
                close: () => void
            }
        }
        pipeline: {
            board: {
                job: (id: string) => void
                open: (candidateId: string) => void
                move: (id: string, stage: string) => void
                dragStart: (id: string) => void
                dragEnd: () => void
                dragOver: (stage: string) => void
                dragLeave: (stage: string) => void
                drop: (stage: string, transferId: string) => void
                clearError: () => void
            }
            reject: {
                reason: Dispatch<SetStateAction<string>>
                confirm: () => void
                close: () => void
            }
        }
        interviews: {
            readonly previousWeek: () => void
            readonly nextWeek: () => void
            readonly thisWeek: () => void
            readonly open: (candidateId: string) => void
            readonly status: (id: string, status: string) => void
            readonly copy: (id: string) => void
            readonly clearError: () => void
        }
        offers: {
            readonly open: (candidateId: string) => void
            readonly copy: (id: string) => void
            readonly cancel: (id: string) => void
            readonly clearError: () => void
        }
        onboarding: {
            readonly toggle: (id: string, done: boolean) => void
            readonly linkStaff: (candidateId: string) => void
            readonly clearError: () => void
        }
    }
}

/** Keeps each controller tied to the exact tab that formerly mounted its block. */
export const useHiringBoardViews = (input: HiringSelectedViewInput): HiringBoardViewsView => {
    const jobs = useHiringJobsView(whenSelected(input, "jobs"))
    const pipeline = useHiringPipelineView(whenSelected(input, "candidates"))
    const interviews = useHiringInterviewsView(whenSelected(input, "interviews"))
    const offers = useHiringOffersView(whenSelected(input, "offers"))
    const onboarding = useHiringOnboardingView(whenSelected(input, "onboarding"))
    return {
        props: {
            jobs: jobs.props,
            pipeline: pipeline.props,
            interviews: interviews.props,
            offers: offers.props,
            onboarding: onboarding.props,
        },
        on: {
            jobs: jobs.on,
            pipeline: pipeline.on,
            interviews: interviews.on,
            offers: offers.on,
            onboarding: onboarding.on,
        },
    }
}
