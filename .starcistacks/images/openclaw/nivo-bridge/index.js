import { readFile, readdir, rm } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"
import { signedTokenOf } from "./bridge-token.js"

const TOOL = "nivo_call"
const TIMEOUT_MS = 55_000

/** One agent id, or the `ws-<hex>-` prefix of every agent of a workspace; nothing else reaches the file system. */
const AGENT_MATCH = /^ws-[0-9a-f]{16}-[a-z0-9]*$/u

const text = (value) => ({ content: [{ type: "text", text: value }] })

const namesIn = (directory) => readdir(directory).catch(() => [])

/** Removes the audit rows of the matched agents from the shared state database, leaving no freed page that still holds them. */
const forgetAudit = (state, match) => {
    const db = new DatabaseSync(join(state, "state", "openclaw.sqlite"))
    try {
        db.exec("PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON")
        const agent = match.endsWith("-") ? `${match}%` : match
        const session = match.endsWith("-") ? `agent:${match}%` : `agent:${match}:%`
        db.prepare("DELETE FROM audit_events WHERE agent_id LIKE ? OR actor_id LIKE ? OR session_key LIKE ?").run(agent, agent, session)
        db.exec("VACUUM")
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)")
    } finally {
        db.close()
    }
}

/** The config backups that still name a matched agent; OpenClaw writes the next backup from the clean config. */
const backupsNaming = async (state, match) => {
    const names = (await namesIn(state)).filter((name) => name.startsWith("openclaw.json.bak"))
    const texts = await Promise.all(names.map((name) => readFile(join(state, name), "utf8").catch(() => "")))
    return names.filter((_, index) => texts[index].includes(match)).map((name) => join(state, name))
}

/**
 * Removes for good what `agents.delete` leaves or never reaches: the agent's state and workspace directories, its audit rows, the
 * config backups naming it and the whole gateway trash. `agents.delete` only moves files to ~/.Trash, under names that do not carry the
 * agent id, so the trash is emptied as a whole; it holds nothing a running agent reads. A retired agent is off the config, so its
 * directories are matched here.
 */
const purge = async (match) => {
    const home = homedir()
    const state = process.env.OPENCLAW_STATE_DIR ?? join(home, ".openclaw")
    const isMatch = (name) => (match.endsWith("-") ? name.startsWith(match) : name === match)
    const workspaces = (await namesIn(state)).filter((name) => name.startsWith("workspace-") && isMatch(name.slice(10)))
    const targets = [
        ...(await namesIn(join(state, "agents"))).filter(isMatch).map((name) => join(state, "agents", name)),
        ...workspaces.map((name) => join(state, name)),
        ...(await backupsNaming(state, match)),
        ...(await namesIn(join(home, ".Trash"))).map((name) => join(home, ".Trash", name)),
    ]
    await Promise.all(targets.map((target) => rm(target, { recursive: true, force: true })))
    forgetAudit(state, match)
    return targets.length
}

/** Posts one NIVO tool call for the session this tool was built for and answers what the api said. */
const callOf = (url, secret, agentId, sessionKey) => async (_id, params) => {
    const name = typeof params?.tool === "string" ? params.tool : ""
    if (name === "" || /[^a-zA-Z0-9._-]/u.test(name)) return text(JSON.stringify({ error: "invalid_tool" }))
    const args = params?.args !== null && typeof params?.args === "object" ? params.args : {}
    const token = signedTokenOf(secret, agentId, sessionKey, Math.floor(Date.now() / 1000))
    try {
        const response = await fetch(`${url}/${encodeURIComponent(name)}`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        const answer = await response.text()
        return text(response.ok ? answer : JSON.stringify({ error: "refused", status: response.status }))
    } catch {
        return text(JSON.stringify({ error: "unreachable" }))
    }
}

export default definePluginEntry({
    id: "nivo-bridge",
    name: "NIVO bridge",
    description: "Gives a NIVO agent one tool, nivo_call, that runs a NIVO tool through the api for the turn that is running.",
    register(api) {
        // Operator maintenance, on the admin scope a turn never holds: the api calls it right after agents.delete.
        api.registerGatewayMethod(
            "nivo.purgeAgents",
            async ({ params, respond }) => {
                const match = typeof params?.match === "string" ? params.match : ""
                if (!AGENT_MATCH.test(match)) {
                    respond(false, undefined, { code: "INVALID_REQUEST", message: "invalid match" })
                    return
                }
                respond(true, { removed: await purge(match) })
            },
            { scope: "operator.admin" },
        )
        const url = process.env.OPENCLAW_BRIDGE_URL ?? ""
        const secret = process.env.OPENCLAW_BRIDGE_SECRET ?? ""
        if (url === "" || secret === "") return
        // The agent and the session come from OpenClaw's own tool context; the model supplies the tool name and its arguments only.
        api.registerTool(
            (context) => {
                const { agentId, sessionKey } = context
                if (typeof agentId !== "string" || typeof sessionKey !== "string") return null
                return {
                    name: TOOL,
                    label: TOOL,
                    description:
                        "Run one NIVO tool. `tool` is a tool name from the tool list in your instructions, `args` its arguments as an object.",
                    parameters: {
                        type: "object",
                        additionalProperties: false,
                        required: ["tool"],
                        properties: {
                            tool: { type: "string", description: "The NIVO tool name, for example tool.search." },
                            args: { type: "object", description: "The arguments of that tool." },
                        },
                    },
                    execute: callOf(url, secret, agentId, sessionKey),
                }
            },
            { name: TOOL },
        )
    },
})
