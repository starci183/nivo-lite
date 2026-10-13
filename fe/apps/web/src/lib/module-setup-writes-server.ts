import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { byKey, proposeFact } from "./brain/facts"
import { answerGap } from "./brain/gaps"
import { keyOf, sameValue, type Evidence, type Scope } from "./brain/shared"
import { logEvidence } from "./core"
import { enqueueWorkspaceSync } from "./engine-queue"
import type { EngineCtx } from "./engine"
import { actionDef, moduleName, type ModuleKey } from "./module-registry"
import {
    targetKey,
    type FactPayload,
    type OpenGap,
    type ProposedWrite,
    type Resolution,
    type RulePayload,
    type SetupWrite,
    type WriteDecision,
    type WriteResult,
    type WriteStatus,
} from "./module-setup-writes"
import { saveRuleCore } from "./owner-chat"
import {
    readAuthorityRule,
    readOpenGaps,
    readSetupCard,
    readSetupCards,
    readSetupMessage,
    type SetupCardRow,
} from "@/modules/db"
import { writeCloseCard } from "@/modules/db/module-setup/write-close-card"
import { writeSetupCards } from "@/modules/db/module-setup/write-setup-cards"
import type { Locale } from "@/i18n/core"

/**
 * The confirm cards of the setup chat, over the setup readers and writers of modules/db. Nothing here talks to the database itself: the
 * cards are stored and closed through modules/db/module-setup, the rule in force and the open customer questions are read through it.
 * Facts reach the Second Brain through lib/brain, which Wave 3 points at the back end.
 */
type Db = SupabaseClient

const fail = (kind: string): never => {
    throw new Error(kind)
}

/** A stored card as the typed card of the screens (the payload was validated when the turn produced it). */
const toWrite = (card: SetupCardRow, current: SetupWrite["current"]): SetupWrite =>
    ({
        id: card.id,
        setupSessionId: card.setupSessionId,
        sourceMessageId: card.sourceMessageId,
        gateKey: card.gateKey,
        status: card.status as WriteStatus,
        result: card.result as WriteResult | null,
        decidedBy: card.decidedBy,
        createdAt: card.createdAt,
        kind: card.kind,
        payload: card.payload as unknown as FactPayload | RulePayload,
        current,
    }) as SetupWrite

/* ------------------------------------------------------------------ current values (the conflict) */

/** The rule in force for an action: the stored row, else what installing the module grants. */
const ruleInForce = async (
    ws: string,
    action: RulePayload["action"],
): Promise<{ mode: RulePayload["mode"]; limitVnd: number | null; requiredFields: Array<string> }> => {
    const stored = await readAuthorityRule(ws, action)
    if (stored.kind === "ok")
        return {
            mode: stored.value.mode as RulePayload["mode"],
            limitVnd: stored.value.limitVnd,
            requiredFields: [...stored.value.requiredFields],
        }
    const def = actionDef(action)
    return { mode: def.mode, limitVnd: def.limitVnd, requiredFields: [...def.requiredFields] }
}

/** The active fact for the same subject + attribute in one scope (the brain keeps exactly one per scope: shared, or one instance's own). */
const factInForce = async (
    db: Db,
    ws: string,
    p: Pick<FactPayload, "subjectLabel" | "attributeLabel">,
    installationId: string | null = null,
) => {
    const [active] = await byKey(db, ws, keyOf(p.subjectLabel), keyOf(p.attributeLabel), "active", installationId)
    return active ?? null
}

const currentOf = async (db: Db, ws: string, card: SetupCardRow): Promise<SetupWrite["current"]> => {
    if (card.status !== "proposed") return null
    if (card.kind === "fact") {
        const active = await factInForce(db, ws, card.payload as unknown as FactPayload)
        return active ? { value: active.value, scope: active.scope, modules: active.modules } : null
    }
    const rule = await ruleInForce(ws, (card.payload as unknown as RulePayload).action)
    return { mode: rule.mode, limitVnd: rule.limitVnd }
}

/* ------------------------------------------------------------------ store and load */

/**
 * Store the writes a turn proposed as confirm cards. A rule card is completed with the half the owner did not change (mode or limit) from the
 * rule in force; a rule that would change nothing is dropped. A waiting card for the same target is replaced (marked superseded).
 */
export const storeWrites = async (
    ws: string,
    setupSessionId: string,
    sourceMessageId: string,
    proposed: ReadonlyArray<ProposedWrite>,
): Promise<void> => {
    const cards: Array<{
        gateKey: string
        kind: "fact" | "rule"
        targetKey: string
        payload: Record<string, unknown>
    }> = []
    for (const w of proposed) {
        let payload: FactPayload | RulePayload
        if (w.kind === "fact") payload = w.payload
        else {
            const have = await ruleInForce(ws, w.payload.action)
            const mode = w.payload.mode ?? have.mode
            const limitVnd = w.payload.limitVnd === undefined ? have.limitVnd : w.payload.limitVnd
            if (mode === have.mode && limitVnd === have.limitVnd) continue
            payload = { action: w.payload.action, field: w.payload.field, mode, limitVnd }
        }
        cards.push({ gateKey: w.gateKey, kind: w.kind, targetKey: targetKey(w), payload: { ...payload } })
    }
    const stored = await writeSetupCards({ setupSessionId, sourceMessageId, cards })
    if (stored.kind !== "ok") fail(`cards: ${stored.kind}`)
}

/** Every write card of the given setup sessions, oldest first (superseded ones are hidden). Waiting cards carry the value in force. */
export const loadWrites = async (db: Db, ws: string, sessionIds: ReadonlyArray<string>): Promise<Array<SetupWrite>> => {
    const cards = await readSetupCards(sessionIds)
    if (cards.kind !== "ok") return [] // before the migration ran: the chat still works, without cards
    return Promise.all(cards.value.map(async (card) => toWrite(card, await currentOf(db, ws, card))))
}

/* ------------------------------------------------------------------ open knowledge gaps */

/**
 * The questions customers asked that the module's agent could not answer yet (knowledge_gaps, status open), most asked first. The table is
 * added by another change: when it is missing or unreadable this returns nothing and the setup chat simply has no gaps to ask about.
 */
export const openGapsFor = async (ws: string, moduleKey: ModuleKey, limit = 5): Promise<Array<OpenGap>> => {
    const gaps = await readOpenGaps(ws, moduleKey, limit)
    if (gaps.kind !== "ok") return []
    return gaps.value.map((g) => ({
        id: g.id,
        question: g.question,
        topic: g.topic,
        attributeGuess: g.attributeGuess,
        count: g.count,
    }))
}

/* ------------------------------------------------------------------ deciding a card */

const SCOPES: ReadonlyArray<Scope> = ["public", "internal", "restricted"]

/**
 * The owner decides one card. Reject: nothing is written. Confirm (with the owner's edits, if any):
 *  - fact: proposeFact with source "owner" (auto-applied), evidence pointing at the setup message, restricted facts limited to this module. If a
 *    different value is in force the owner must have chosen: replace (history kept), keep (nothing written) or keep both (a separate fact for a
 *    named situation, the way the Brain's conflict card splits);
 *  - rule: the same authority write the /authority page uses (saveRuleCore), logged as evidence.
 */
export const decideWrite = async (
    ctx: EngineCtx,
    moduleKey: ModuleKey,
    locale: Locale,
    writeId: string,
    change: WriteDecision,
    /** The instance whose setup chat this is, when its type allows several (a fact confirmed "only for this agent" is scoped to it). */
    instance: { readonly id: string; readonly isMulti: boolean } | null = null,
): Promise<SetupWrite> => {
    const found = await readSetupCard(writeId)
    if (found.kind !== "ok") return fail("Not found")
    const row = found.value
    if (row.status !== "proposed") return fail("Already decided")

    const close = async (
        status: "applied" | "rejected",
        payload: Record<string, unknown>,
        result: Record<string, unknown>,
    ): Promise<SetupWrite> => {
        const closed = await writeCloseCard({ cardId: writeId, status, payload, result })
        if (closed.kind !== "ok") return fail("Already decided")
        return toWrite(closed.value, null)
    }

    if (change.decision === "reject") return close("rejected", { ...(row.payload as object) }, { outcome: "rejected" })

    if (row.kind === "rule") {
        const base = row.payload as unknown as RulePayload
        const mode = change.rule?.mode ?? base.mode
        const limitVnd = change.rule ? change.rule.limitVnd : base.limitVnd
        const have = await ruleInForce(ctx.ws, base.action)
        const rule = await saveRuleCore(ctx, {
            department: moduleKey,
            action: base.action,
            mode,
            limit_vnd: actionDef(base.action).amountLimit ? limitVnd : null,
            required_fields: have.requiredFields,
        })
        await logEvidence(ctx.db, ctx.ws, {
            kind: "authority.rule_updated",
            actor: ctx.actor,
            summary: `${moduleKey}.${base.action} → ${mode}${rule.limit_vnd !== null ? ` < ${rule.limit_vnd}` : ""} (${moduleName(moduleKey, locale)} setup chat)`,
        })
        return close("applied", { ...base, mode, limitVnd: rule.limit_vnd }, { outcome: "applied", ruleId: rule.id })
    }

    const base = row.payload as unknown as FactPayload
    const edit = change.fact
    const value = (edit?.value ?? base.value).trim()
    const scope = edit?.scope && SCOPES.includes(edit.scope) ? edit.scope : base.scope
    const subjectLabel = (edit?.subjectLabel ?? base.subjectLabel).trim()
    const baseAttribute = (edit?.attributeLabel ?? base.attributeLabel).trim()
    if (!value || !subjectLabel || !baseAttribute) return fail("A fact needs a subject, an attribute and a value.")

    const scopeId = change.onlyThisAgent && instance?.isMulti ? instance.id : null
    const current = await factInForce(ctx.db, ctx.ws, { subjectLabel, attributeLabel: baseAttribute }, scopeId)
    const conflict = current !== null && !sameValue(current.value, value)
    let resolution: Resolution | undefined
    if (conflict) {
        resolution = change.resolution
        if (!resolution) return fail("Choose what to do with the value already in the Second Brain.")
    }
    const edited: FactPayload = { ...base, subjectLabel, attributeLabel: baseAttribute, value, scope }
    if (resolution === "keep") return close("rejected", { ...edited }, { outcome: "kept_current", resolution })

    let attributeLabel = baseAttribute
    if (resolution === "both") {
        const situation = (change.situation ?? "").trim()
        if (!situation) return fail("Name the situation the new value is for.")
        attributeLabel = `${baseAttribute} (${situation})`.slice(0, 120)
    }

    const message = row.sourceMessageId ? await readSetupMessage(row.sourceMessageId) : null
    const evidence: Evidence = {
        kind: "message",
        ref: row.sourceMessageId ?? `setup:${row.setupSessionId}`,
        label: `${moduleName(moduleKey, locale)} · setup chat (${row.gateKey})`,
        quote: message?.kind === "ok" ? message.value.body.slice(0, 300) : undefined,
        at: new Date().toISOString(),
    }
    const { fact, outcome } = await proposeFact(ctx.db, ctx.ws, {
        subjectType: base.subjectType,
        subjectLabel,
        attributeLabel,
        value,
        scope,
        modules: scope === "restricted" ? [moduleKey] : [],
        sourceKind: "owner",
        proposedBy: ctx.actor,
        evidence: [evidence],
        installationId: scopeId,
    })
    if (fact.status !== "active") return fail("The Second Brain kept this value for review instead of applying it.")
    if (base.gapId) await answerGap(ctx.db, ctx.ws, base.gapId, `fact:${fact.id}`).catch(() => undefined)
    await enqueueWorkspaceSync(ctx.ws)
    return close(
        "applied",
        { ...edited, attributeLabel },
        { outcome, factId: fact.id, ...(resolution ? { resolution } : {}) },
    )
}
