import { builder } from "@starci/jest-preset"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import type { CardRecord, FactCardPayload, RuleCardPayload } from "@modules/domain/module-setup-writes"

const NOW = "2026-10-13T02:00:00.000Z"

/** A fact proposed by a setup card. */
export const factOf = builder<FactRecord>({
    id: "fact-1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "opening-hours",
    attributeLabel: "Opening hours",
    value: "7 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 1,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Lan",
    proposedAt: NOW,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})
/** An open knowledge gap offered during setup. */
export const gapOf = builder<GapRecord>({
    id: "gap-1",
    module: "accounting",
    question: "Do you take cards?",
    topic: null,
    attributeGuess: null,
    count: 3,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    exampleConversationId: null,
    status: "open",
    reopenedCount: 0,
})

/** An accounting action of the authority registry. */
export const actionOf = builder<AuthorityActionRecord>({
    action: "issue_invoice",
    module_key: "accounting",
    sort_order: 1,
    default_mode: "ask",
    default_limit_vnd: null,
    default_required_fields: [],
    amount_limit: false,
    max_mode: null,
    label: { en: "Issue an invoice", vi: "Xuat hoa don" },
})

/** The registry the setup cards are checked against: two free actions and one that can never run alone. */
export const REGISTRY = [
    actionOf(),
    actionOf({ action: "send_email" }),
    actionOf({ action: "pay_vendor", max_mode: "ask" }),
]

/** An authority rule of the accounting module. */
export const ruleOf = builder<AuthorityRuleRecord>({
    id: "rule-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    mode: "ask",
    limit_vnd: 1000000,
    required_fields: ["customer"],
    note: "",
    updated_at: "2026-10-01T00:00:00.000Z",
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
    approver_roles: ["owner", "manager"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 30,
})
/** The open setup session of the installation. */
export const SESSION: SetupSessionRecord = {
    id: "s-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "", facts: [] },
    gateEvidence: {},
    createdAt: NOW,
}
/** The accounting installation in setup. */
export const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Accounting",
    isMulti: true,
    agentId: "agent-1",
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    settings: {},
    createdAt: NOW,
})

export const FACT: FactCardPayload = {
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Opening hours",
    value: "7 to 21",
    scope: "public",
}
export const RULE: RuleCardPayload = { action: "issue_invoice", field: "limit_vnd", mode: "auto", limitVnd: 5000000 }
export const CARD_BASE: Omit<CardRecord, "kind" | "payload"> = {
    id: "card-1",
    workspaceId: "ws-1",
    setupSessionId: "s-1",
    sourceMessageId: "m-1",
    gateKey: "scope",
    targetKey: "fact:shop|opening-hours",
    status: "proposed",
    result: null,
    decidedBy: null,
    createdAt: "2026-10-13T01:00:00.000Z",
}
/** A fact card of the setup session, proposed unless a status is named. */
export const factCard = (
    payload: Partial<FactCardPayload> = {},
    status: CardRecord["status"] = "proposed",
): CardRecord => ({
    ...CARD_BASE,
    status,
    kind: "fact",
    payload: { ...FACT, ...payload },
})
/** A rule card of the setup session. */
export const ruleCard = (payload: Partial<RuleCardPayload> = {}): CardRecord => ({
    ...CARD_BASE,
    targetKey: "rule:issue_invoice",
    kind: "rule",
    payload: { ...RULE, ...payload },
})
