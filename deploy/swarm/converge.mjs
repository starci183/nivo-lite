#!/usr/bin/env node
// Observes convergence of the stack on the daemon DOCKER_HOST points at: desired versus running replicas, the update state of every service,
// and failed or rejected tasks created since the deploy began. A `docker stack deploy` request returns before any of this is true.
// Exit 0 converged, 1 failed (a rolled back update, a failed task, or the timeout); the reason and the failing service's task errors are printed.
//
//   DOCKER_HOST=ssh://vps node deploy/swarm/converge.mjs --stack nivo --since <ISO instant> [--timeout 600]
import { spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
    const at = args.indexOf(name)
    return at < 0 ? fallback : args[at + 1]
}
const stack = flag("--stack", "nivo")
const since = Date.parse(flag("--since", new Date(Date.now() - 60_000).toISOString()))
const timeoutMs = Number(flag("--timeout", "600")) * 1000
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const docker = (dockerArgs) => {
    const run = spawnSync("docker", dockerArgs, { encoding: "utf8", maxBuffer: 1 << 24 })
    if (run.status !== 0)
        throw new Error(`docker ${dockerArgs.slice(0, 2).join(" ")}: ${run.stderr.trim().split("\n")[0]}`)
    return run.stdout
}
const lines = (text) => text.split(/\r?\n/u).filter(Boolean)

/** One observation: { ok, pending: [text], failed: [text] } over every service of the stack. */
const observe = () => {
    const services = lines(
        docker(["service", "ls", "--filter", `label=com.docker.stack.namespace=${stack}`, "--format", "{{.Name}}"]),
    )
    const result = { ok: services.length > 0, pending: [], failed: [], services }
    if (services.length === 0) result.pending.push(`no service of stack ${stack} yet`)
    for (const name of services) {
        const inspect = JSON.parse(docker(["service", "inspect", name, "--format", "{{json .}}"]))
        const desired = inspect.Spec?.Mode?.Replicated?.Replicas ?? 1
        const update = inspect.UpdateStatus
        const updateStarted = update?.StartedAt ? Date.parse(update.StartedAt) : 0
        if (update && updateStarted >= since && /rollback|paused/u.test(update.State)) {
            result.failed.push(`${name}: update ${update.State}: ${update.Message ?? ""}`)
            continue
        }
        if (update && updateStarted >= since && update.State === "updating")
            result.pending.push(`${name}: update in progress`)
        const taskIds = lines(docker(["service", "ps", name, "--no-trunc", "-q"]))
        let running = 0
        for (const task of taskIds.length > 0
            ? lines(
                  docker([
                      "inspect",
                      "--type",
                      "task",
                      "--format",
                      "{{.DesiredState}}|{{.Status.State}}|{{.Status.Timestamp}}|{{.Status.Err}}",
                      ...taskIds,
                  ]),
              )
            : []) {
            const [wanted, state, timestamp, error] = task.split("|")
            if (wanted === "running" && state === "running") running += 1
            if ((state === "failed" || state === "rejected") && Date.parse(timestamp) >= since)
                result.failed.push(`${name}: task ${state}: ${error}`)
        }
        if (running !== desired) result.pending.push(`${name}: ${running}/${desired} running`)
    }
    result.ok = result.ok && result.pending.length === 0 && result.failed.length === 0
    return result
}

const deadline = Date.now() + timeoutMs
let last = { pending: ["not observed"], failed: [], services: [] }
let stable = 0
while (Date.now() < deadline) {
    try {
        last = observe()
    } catch (error) {
        last = { ok: false, pending: [String(error.message)], failed: [], services: last.services }
    }
    if (last.failed.length > 0) break
    // Converged only when two consecutive observations agree: a task that starts and immediately exits is caught by the second look.
    stable = last.ok ? stable + 1 : 0
    if (stable >= 2) {
        process.stdout.write(`converge: ${last.services.join(", ")}: desired replicas running, no failed task\n`)
        process.exit(0)
    }
    await sleep(5000)
}
process.stderr.write(
    `converge: ${last.failed.length > 0 ? "FAILED" : "TIMEOUT"}\n${[...last.failed, ...last.pending].map((line) => `  ${line}`).join("\n")}\n`,
)
process.exit(1)
