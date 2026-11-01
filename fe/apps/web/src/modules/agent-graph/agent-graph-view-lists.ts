import type {
    AgentGraphBadgeView,
    AgentGraphBranchesView,
    AgentGraphData,
    AgentGraphProposalData,
    AgentGraphProposalKind,
    AgentGraphProposalView,
    AgentGraphProposalsView,
    AgentGraphRunData,
    AgentGraphRunView,
    AgentGraphVersionsView,
} from "@/modules/types"
import { branchHitsOf } from "./agent-graph-flow"
import { sourceWordOf } from "./agent-graph-words"
import type { AgentGraphContext, AgentGraphT } from "./agent-graph-words"

/** How many rows of evidence show before "See all". */
export const EVIDENCE_PREVIEW = 3

const kindWordOf = (t: AgentGraphT, kind: AgentGraphProposalKind): string => {
    if (kind === "conflict") return t("proposal_conflict")
    return kind === "learned" ? t("proposal_learned") : t("proposal_template")
}

/** Why this person may not add a proposal to the draft; empty when they may. */
const blockedOf = (proposal: AgentGraphProposalData, ctx: AgentGraphContext): string => {
    if (!ctx.canEdit) return ctx.t("cannotEdit")
    return proposal.widens && !ctx.isOwner ? ctx.t("ownerOnly") : ""
}

const proposalViewOf = (proposal: AgentGraphProposalData, ctx: AgentGraphContext): AgentGraphProposalView => {
    const { t } = ctx
    const widensLabel = (() => {
        if (proposal.widens) return t("badgeWidens")
        return proposal.kind === "conflict" ? t("badgeChoose") : t("badgeStricter")
    })()
    return {
        id: proposal.id,
        kind: proposal.kind,
        kindLabel: kindWordOf(t, proposal.kind),
        widensLabel,
        widensTone: proposal.widens ? "warning" : "muted",
        title: proposal.title,
        why: proposal.why,
        beforeTitle: t("conflictBefore"),
        before: proposal.before,
        afterTitle: t("conflictAfter"),
        after: proposal.after,
        effectsTitle: t("effectsTitle"),
        effects: proposal.effects,
        evidenceTitle: t("evidenceTitle"),
        evidence: proposal.evidence,
        evidenceMoreLabel:
            proposal.evidence.length > EVIDENCE_PREVIEW ? t("evidenceAll", { count: proposal.evidence.length }) : "",
        confirmLabel: proposal.confirmLabel,
        keepLabel: proposal.keepLabel,
        confirmBlocked: blockedOf(proposal, ctx),
    }
}

/** The proposals waiting for a person: Brain conflicts and learned changes, each with what proves it. */
export const proposalsViewOf = (data: AgentGraphData, ctx: AgentGraphContext): AgentGraphProposalsView => ({
    title: ctx.t("proposalsTitle"),
    hint: ctx.t("proposalsHint"),
    emptyText: ctx.t("proposalsEmpty"),
    items: data.proposals.map((proposal) => proposalViewOf(proposal, ctx)),
})

/** The history: the draft first when it has changes, then every saved version, newest first. */
export const versionsViewOf = (data: AgentGraphData, ctx: AgentGraphContext): AgentGraphVersionsView => {
    const { t } = ctx
    const draft: AgentGraphVersionsView["items"] =
        data.changes === 0
            ? []
            : [
                  {
                      id: "draft",
                      title: t("versionN", { version: data.activeVersion + 1 }),
                      badge: { text: t("badgeDraft"), tone: "neutral" },
                      note: t("draftChanges", { count: data.changes }),
                      byLine: t("draftByYou"),
                      restoreLabel: "",
                      canRestore: false,
                  },
              ]
    const saved = data.versions.map((version) => {
        const badge: AgentGraphBadgeView | null = version.isActive ? { text: t("badgeRunning"), tone: "success" } : null
        return {
            id: version.id,
            title: t("versionN", { version: version.version }),
            badge,
            note: version.note,
            byLine: t("versionBy", { by: version.byLine, runs: version.runs }),
            restoreLabel: t("restore"),
            canRestore: ctx.canEdit && !version.isActive,
        }
    })
    const mode = {
        title: t("modeTitle"),
        label: t("modeEnforce"),
        hint: data.mode === "enforced" ? t("modeHintEnforced") : t("modeHintShadow"),
        isEnforced: data.mode === "enforced",
        isDisabled: !ctx.isOwner,
    }
    return { mode, title: t("versionsTitle"), hint: t("versionsHint"), items: [...draft, ...saved] }
}

/** Every branch as a sentence for the phone: when, what happens, with what and on whose rule. */
export const branchesViewOf = (data: AgentGraphData, ctx: AgentGraphContext): AgentGraphBranchesView => {
    const { t } = ctx
    const decide = data.nodes.find((node) => node.branches.length > 0)
    return {
        title: decide === undefined ? t("branchesTitle") : decide.intent,
        hint: t("branchesHint"),
        emptyLabel: t("branchesEmpty"),
        rows: branchHitsOf(data.nodes).flatMap((hit) => {
            const target = data.nodes.find((node) => node.key === hit.branch.next)
            if (target === undefined) return []
            const source = hit.branch.selfCorrected ? "corrected" : (hit.branch.sources[0]?.kind ?? null)
            return [
                {
                    id: `${hit.parent.key}:${hit.branch.key}`,
                    nodeKey: target.key,
                    when: hit.branch.when,
                    title: target.title,
                    line: target.card.description,
                    source: source === null ? "" : sourceWordOf(t, source),
                    openLabel: t("openDetail"),
                },
            ]
        }),
    }
}

/** A traced run: what happened, step by step, and what the run left out. */
export const runViewOf = (run: AgentGraphRunData, ctx: AgentGraphContext): AgentGraphRunView => ({
    title: run.title,
    outcome: run.outcome,
    summary: run.summary,
    mismatch: run.mismatch,
    stepsLabel: ctx.t("runSteps"),
    steps: run.steps,
    skipped: run.skipped,
    backLabel: ctx.t("runBack"),
})
