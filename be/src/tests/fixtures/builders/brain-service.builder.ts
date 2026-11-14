import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The workspace the brain service specs run in. */
export const SERVICE_WS = "ws-1"

/** The instant the brain service specs run at. */
export const SERVICE_AT = "2026-10-12T10:00:00.000Z"

/** One truth of the shop, in force and public. */
export const serviceFactOf: (changes?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: SERVICE_AT,
    decidedBy: "Ada",
    decidedAt: SERVICE_AT,
    decisionNote: null,
})

/** The owner Ada, a member of the workspace. */
export const serviceMemberOf: (changes?: Partial<WorkspaceMember>) => WorkspaceMember = builder<WorkspaceMember>({
    userId: "u1",
    workspaceId: SERVICE_WS,
    role: "owner",
    staffId: null,
    displayName: "Ada",
    status: "active",
})

/** A manual lesson, active. */
export const serviceLesson: LessonRecord = {
    id: "l1",
    module: null,
    title: "Confirm",
    body: "Confirm hours",
    appliesWhen: "Before replying",
    status: "active",
    origin: "manual",
    evidence: [],
    version: 1,
    proposedBy: "Ada",
    proposedAt: SERVICE_AT,
    decidedBy: "Ada",
    decidedAt: SERVICE_AT,
}
