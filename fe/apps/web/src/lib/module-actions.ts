"use server"

import { revalidatePath } from "next/cache"
import { getLocale, getT } from "@/i18n/server"
import { moduleSetup } from "@/i18n/dict/moduleSetup"
import { modulesCore } from "@/i18n/dict/modulesCore"
import { enqueueAgentSync } from "./engine-queue"
import { isMultiInstance } from "./module-registry"
import { mergeSetupTurn, runSetupTurn } from "./module-setup-ai"
import type { SetupWrite, WriteDecision } from "./module-setup-writes"
import { decideWrite, loadWrites, openGapsFor, storeWrites } from "./module-setup-writes-server"
import { engineCtx } from "./flow-ctx"
import { withUsage } from "./usage"
import { getInstallationById } from "./modules-core"
import {
    agentHref,
    isModuleKey,
    type Installation,
    type ModuleKey,
    type OperatingMode,
    type SetupMessage,
    type SetupRevision,
    type SetupSession,
} from "./modules-shared"
import { requireManager } from "./permissions"
import { getSession } from "./session"
import type { Outcome } from "./types"
import type { DbOutcome } from "@/modules/db"
import {
    dbFailure,
    dbOk,
    readSessionMessages,
    readSetupCard,
    readSetupSession,
    readSetupState,
    writeApplySetup,
    writeDraftSession,
    writeGate,
    writeInstallModule,
    writeModuleLive,
    writeOperatingMode,
    writeRenameAgent,
    writeRenameInstance,
    writeSetupMessage,
    writeSetupTurn,
} from "@/modules/db"

/**
 * The server actions of the agent catalogue, the setup chat and the settings tab. The database is reached only through modules/db
 * (modules, module-setup); what stays here is the part that is not the database: who may act, the model call of the setup chat,
 * the Second Brain and the authority gate, the queue and the revalidation. Wave 3 moves the orchestration to the back end.
 */

/* ------------------------------------------------------------------ helpers */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
    try {
        return { ok: true, data: await fn() }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** The value of an outcome of modules/db, or the plain text of a failure the screens show (known codes are translated). */
const unwrap = async <T>(outcome: DbOutcome<T>): Promise<T> => {
    if (outcome.kind === "ok") return outcome.value
    const t = await getT(modulesCore)
    const ts = await getT(moduleSetup)
    const known: Record<string, string> = {
        "instance-name": t("instanceNameInvalid"),
        "instance-name-taken": t("instanceNameTaken"),
        "single-instance-only": t("instanceSingleOnly"),
        "needs-version": t("liveNeedsVersion"),
        "gates-unconfirmed": ts("applyHint"),
        unchanged: ts("applyUnchanged"),
    }
    throw new Error(known[outcome.code] ?? `${outcome.kind}: ${outcome.code}`)
}

const refresh = () => revalidatePath("/", "layout")

/* ------------------------------------------------------------------ catalogue */

/** Install a module: its installation, its agent (reused when the workspace already has one), its default authority rules, the first setup session and the OpenClaw sync. Any module of the catalogue. */
export const installModule = async (
    moduleKey: ModuleKey,
): Promise<Outcome<{ moduleKey: ModuleKey; installationId: string }>> =>
    run(async () => {
        if (!isModuleKey(moduleKey)) throw new Error("Unknown agent")
        await requireManager()
        const session = await getSession()
        const result = await unwrap(
            await writeInstallModule({ workspaceId: session.workspace.id, moduleKey, locale: await getLocale() }),
        )
        // OpenClaw gets the agent's copy right away (base knowledge + the module's gates); the setup chat itself already runs through openclaw.generate.
        await enqueueAgentSync(result.installationId, { force: true }).catch(() => false)
        refresh()
        return { moduleKey, installationId: result.installationId }
    })

/** Install an agent from the catalogue and answer the page to open (the refusal code carries the text the screen shows). */
export const installAgent = async (moduleKey: string): Promise<DbOutcome<string>> => {
    if (!isModuleKey(moduleKey)) return dbFailure("invalid", "module")
    const installed = await installModule(moduleKey)
    return installed.ok ? dbOk(agentHref(moduleKey, null)) : dbFailure("unavailable", installed.error)
}

/**
 * Add another instance of a multi-instance type (one Chatbot per branch, brand or Fanpage): a new installation with its own agent, setup
 * chat and connections. Authority rules stay per type (shared by every instance).
 */
export const addInstance = async (
    moduleKey: ModuleKey,
    name: string,
): Promise<Outcome<{ moduleKey: ModuleKey; installationId: string }>> =>
    run(async () => {
        if (!isModuleKey(moduleKey)) throw new Error("Unknown agent")
        await requireManager()
        if (!isMultiInstance(moduleKey)) throw new Error((await getT(modulesCore))("instanceSingleOnly"))
        const session = await getSession()
        const result = await unwrap(
            await writeInstallModule({
                workspaceId: session.workspace.id,
                moduleKey,
                locale: await getLocale(),
                newInstance: true,
                name,
            }),
        )
        await enqueueAgentSync(result.installationId, { force: true }).catch(() => false)
        refresh()
        return { moduleKey, installationId: result.installationId }
    })

/** Rename an instance (its label in lists, the chrome and Office). Unique per type in the workspace, case-insensitive. */
export const renameInstance = async (installationId: string, name: string): Promise<Outcome<Installation>> =>
    run(async () => {
        await requireManager()
        const renamed = await unwrap(await writeRenameInstance({ installationId, name }))
        refresh()
        return renamed
    })

/* ------------------------------------------------------------------ setup chat */

export type SetupState = {
    installation: Installation
    /** The current draft session: new messages go here and realtime follows it. */
    session: SetupSession
    /** Every earlier and current revision of this installation, oldest first (for the history dividers). */
    revisions: Array<SetupRevision>
    /** The whole chat across every revision, oldest first. */
    messages: Array<SetupMessage>
    /** The confirm cards of the chat (Second Brain facts and authority rules NIVO proposed from the owner's answers). */
    writes: Array<SetupWrite>
}

/** Everything the Setup tab of one instance needs: the draft session (created on first open) and the full chat history of the installation. */
export const loadSetup = async (installationId: string): Promise<Outcome<SetupState>> =>
    run(async () => {
        await requireManager()
        const session = await getSession()
        const db = (await engineCtx()).db
        // The installation list is cached for the request (the instance layout reads it too), so this costs no request of its own.
        const installation = await getInstallationById(installationId)
        if (!installation) throw new Error("Not found")
        // Sessions and the whole chat in ONE wave (the chat is filtered through its session's installation).
        let state = await unwrap(await readSetupState(installation.id))
        let draft = state.draft
        if (draft === null) {
            // No open draft yet (first visit, or the last revision was applied): create it, then read again.
            draft = await unwrap(
                await writeDraftSession({ installationId: installation.id, locale: await getLocale() }),
            )
            state = await unwrap(await readSetupState(installation.id))
        }
        const writes = await loadWrites(
            db,
            session.workspace.id,
            state.revisions.map((r) => r.id),
        )
        return { installation, session: draft, revisions: state.revisions, messages: state.messages, writes }
    })

/** Messages of a setup session (initial load and refresh). */
export const listSetupChat = async (setupSessionId: string): Promise<Outcome<Array<SetupMessage>>> =>
    run(async () => {
        await requireManager()
        return unwrap(await readSessionMessages(setupSessionId))
    })

/** One owner message: ONE model call, merged into the draft; NIVO's reply is stored as the next chat message. */
export const sendSetupMessage = async (
    setupSessionId: string,
    text: string,
): Promise<Outcome<{ session: SetupSession; messages: Array<SetupMessage>; writes: Array<SetupWrite> }>> =>
    run(async () => {
        await requireManager()
        const ctx = await engineCtx()
        const ws = ctx.ws
        const draftSession = await unwrap(await readSetupSession(setupSessionId))
        if (draftSession.status !== "draft") throw new Error("Not found")
        const installation = await getInstallationById(draftSession.installationId)
        if (!installation) throw new Error("Not found")
        const history = await unwrap(await readSessionMessages(setupSessionId))

        const message = await unwrap(await writeSetupMessage({ setupSessionId, body: text }))

        // The customer questions the agent could not answer yet (knowledge gaps) are part of what the chat asks about.
        const gaps = await openGapsFor(ws, installation.moduleKey)
        const turn = await withUsage({ workspaceId: ws }, () =>
            runSetupTurn({
                moduleKey: installation.moduleKey,
                installationId: installation.id,
                locale: ctx.locale,
                draft: draftSession.draft,
                gates: draftSession.gateEvidence,
                history: history.map((m) => ({ role: m.role, body: m.body })),
                message: message.body,
                gaps,
            }),
        )
        const merged = mergeSetupTurn(draftSession.draft, draftSession.gateEvidence, turn)
        const updated = await unwrap(
            await writeSetupTurn({ setupSessionId, reply: turn.reply, draft: merged.draft, gates: merged.gates }),
        )
        // What the owner said becomes confirm cards (facts for the Second Brain, authority rules); nothing is written until they confirm.
        await storeWrites(ws, setupSessionId, message.id, turn.writes)
        return {
            session: updated,
            messages: await unwrap(await readSessionMessages(setupSessionId)),
            writes: await loadWrites(ctx.db, ws, [setupSessionId]),
        }
    })

/**
 * The owner confirms (optionally edited) or rejects one card of the setup chat. Confirming performs the write: a Second Brain fact (source
 * owner, evidence = the setup message) or an authority rule, through the same code the Brain and Authority pages use.
 */
export const decideSetupWrite = async (writeId: string, change: WriteDecision): Promise<Outcome<SetupWrite>> =>
    run(async () => {
        await requireManager()
        const c = await engineCtx()
        const card = await unwrap(await readSetupCard(writeId))
        const session = await unwrap(await readSetupSession(card.setupSessionId))
        const installation = await getInstallationById(session.installationId)
        if (!installation) throw new Error("Not found")
        const written = await decideWrite(c, installation.moduleKey, c.locale, writeId, change, {
            id: installation.id,
            isMulti: installation.isMulti,
        })
        refresh()
        return written
    })

/** Confirm, reopen or edit one gate of the draft. Editing sets the owner's own wording and confirms it. */
export const setGate = async (
    setupSessionId: string,
    gateKey: string,
    change: { action: "confirm" | "reopen" | "edit"; evidence?: string },
): Promise<Outcome<SetupSession>> =>
    run(async () => {
        await requireManager()
        return unwrap(
            await writeGate({ setupSessionId, gateKey, action: change.action, evidence: change.evidence ?? "" }),
        )
    })

/* ------------------------------------------------------------------ apply */

/** Apply the draft: a new immutable context version becomes the one in use, and the module's agent runs on it right away. */
export const applySetup = async (installationId: string): Promise<Outcome<{ version: number }>> =>
    run(async () => {
        await requireManager()
        const applied = await unwrap(await writeApplySetup({ installationId, locale: await getLocale() }))
        // The agent's OpenClaw copy (AGENTS.md, SOUL.md, knowledge/) follows the new active version (no-op unless the module runs on OpenClaw).
        await enqueueAgentSync(installationId)
        refresh()
        return applied
    })

/* ------------------------------------------------------------------ settings */

/** Rename the module's agent (the display name). */
export const renameModule = async (installationId: string, name: string): Promise<Outcome<Installation>> =>
    run(async () => {
        await requireManager()
        const renamed = await unwrap(await writeRenameAgent({ installationId, name }))
        await enqueueAgentSync(installationId)
        refresh()
        return renamed
    })

/** Operating mode: autopilot applies the Authority rules as configured; assist is a gate in the engine that downgrades "auto" to "ask" (rules are never rewritten). */
export const setOperatingMode = async (installationId: string, mode: OperatingMode): Promise<Outcome<Installation>> =>
    run(async () => {
        await requireManager()
        const updated = await unwrap(await writeOperatingMode({ installationId, mode }))
        refresh()
        return updated
    })

/** Live on/off: live = the agent acts on channels; paused = it stays silent. Going live needs an applied version. */
export const setModuleLive = async (installationId: string, on: boolean): Promise<Outcome<Installation>> =>
    run(async () => {
        await requireManager()
        const updated = await unwrap(await writeModuleLive({ installationId, on }))
        refresh()
        return updated
    })

/* ------------------------------------------------------------------ settings cards (one outcome vocabulary) */

const toDb = <T>(outcome: Outcome<T>): DbOutcome<true> =>
    outcome.ok ? dbOk(true) : dbFailure("invalid", outcome.error)

/** Save the name of an agent; for a multi-instance agent the instance label and its agent share the name. */
export const saveAgentName = async (
    installationId: string,
    name: string,
    isInstance: boolean,
): Promise<DbOutcome<true>> => {
    if (!isInstance) return toDb(await renameModule(installationId, name))
    const renamed = await renameInstance(installationId, name)
    return renamed.ok ? toDb(await renameModule(installationId, name.trim().slice(0, 40))) : toDb(renamed)
}

/** Choose how an agent runs. */
export const chooseOperatingMode = async (installationId: string, mode: OperatingMode): Promise<DbOutcome<true>> =>
    toDb(await setOperatingMode(installationId, mode))

/** Switch an agent live or paused. */
export const chooseLive = async (installationId: string, on: boolean): Promise<DbOutcome<true>> =>
    toDb(await setModuleLive(installationId, on))

/* ------------------------------------------------------------------ setup chat (one outcome vocabulary) */

const valueOf = <T>(outcome: Outcome<T>): DbOutcome<T> =>
    outcome.ok ? dbOk(outcome.data) : dbFailure("unavailable", outcome.error)

/** One owner message of the setup chat; answers the session, the chat and the cards as they are after the turn. */
export const postSetupMessage = async (setupSessionId: string, text: string) =>
    valueOf(await sendSetupMessage(setupSessionId, text))

/** The owner decides one confirm card of the setup chat. */
export const decideCard = async (writeId: string, change: WriteDecision) =>
    valueOf(await decideSetupWrite(writeId, change))

/** The owner confirms, reopens or edits one gate of the draft. */
export const changeGate = async (
    setupSessionId: string,
    gateKey: string,
    change: { action: "confirm" | "reopen" | "edit"; evidence?: string },
) => valueOf(await setGate(setupSessionId, gateKey, change))

/** The owner applies the draft as the next version. */
export const applyDraft = async (installationId: string) => valueOf(await applySetup(installationId))
