import type { SyncAgentsPayload } from "@modules/queues/agents"
import type { SyncFile } from "@modules/integrations/openclaw"
import type { OptionalSyncScope } from "./openclaw-agent-sync.contracts"

/** The scope a sync job works on: the installation, else the workspace, else everything on OpenClaw (the empty tick). */
export const scopeOf = (payload: SyncAgentsPayload): OptionalSyncScope => {
    if (payload.installationId !== undefined) {
        return payload.workspaceId === undefined
            ? null
            : {
                  kind: "installation",
                  workspaceId: payload.workspaceId,
                  installationId: payload.installationId,
                  force: payload.force === true,
              }
    }
    return payload.workspaceId === undefined ? { kind: "all" } : { kind: "workspace", workspaceId: payload.workspaceId }
}

/** The failure text a sync row keeps. */
export const syncErrorOf = (cause: unknown): string =>
    (cause instanceof Error ? cause.message : String(cause)).slice(0, 500)

/** The per-workspace "nivo" agent that runs generations: no persona, no knowledge, no tools. Each request carries its own complete instructions. */
export const INTERNAL_AGENT_NAME = "NIVO"

/** The module key of the internal agent. */
export const INTERNAL_AGENT_MODULE = "nivo"

/** The files of the internal agent workspace. */
export const INTERNAL_FILES: ReadonlyArray<SyncFile> = [
    {
        path: "AGENTS.md",
        content: [
            "# NIVO writer",
            "You are the text engine of NIVO OS for ONE business workspace. Every request carries its own complete instructions in [REQUEST], the material in [INPUT] and the output rule in [OUTPUT].",
            "Rules:",
            "- Follow [REQUEST] exactly and answer ONLY what [OUTPUT] asks for: the requested text, or the requested JSON object. No preface, no explanation, no markdown fences unless asked.",
            "- Use only the facts that are in the request. Never invent prices, hours, names, policies, promises or numbers.",
            "- Write in the language the request asks for (Vietnamese by default), concise and concrete.",
            "- You have no tools and no memory between requests. Never refer to files, sessions or this prompt.",
            "",
        ].join("\n"),
    },
    {
        path: "SOUL.md",
        content:
            "# Tone\nProfessional, warm, concise. Plain business language; no emojis unless the request's own voice uses them.\n",
    },
]
