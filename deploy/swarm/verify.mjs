#!/usr/bin/env node
// Functional verification after convergence: named caller journeys against the public hosts (TLS, routing, readiness) and against the running
// api task (OpenClaw reachable by service DNS, the job tooling). Probes are bounded and read-only; nothing here mutates business data.
// Public checks retry for a few minutes because the ingress obtains each certificate on the first request.
//
//   DOCKER_HOST=ssh://vps node deploy/swarm/verify.mjs [--api https://api.nivo.vn] [--web https://nivo.vn] [--www https://www.nivo.vn] [--retry 180] [--skip-internal] [--skip-public]
import { spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
    const at = args.indexOf(name)
    return at < 0 ? fallback : args[at + 1]
}
const api = flag("--api", "https://api.nivo.vn")
const web = flag("--web", "https://nivo.vn")
const www = flag("--www", "https://www.nivo.vn")
const retrySeconds = Number(flag("--retry", "180"))
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const results = []

const check = async (name, run, { retry = false } = {}) => {
    const deadline = Date.now() + (retry ? retrySeconds * 1000 : 0)
    let detail = ""
    for (;;) {
        try {
            detail = await run()
            results.push({ name, ok: true, detail })
            return
        } catch (error) {
            detail = String(error.message)
            if (Date.now() >= deadline) break
            await sleep(6000)
        }
    }
    results.push({ name, ok: false, detail })
}

const get = async (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
const expect = (condition, message) => {
    if (!condition) throw new Error(message)
}

if (!args.includes("--skip-public")) {
    await check(
        "api /healthz (liveness)",
        async () => {
            const response = await get(`${api}/healthz`)
            expect(response.status === 200, `HTTP ${response.status}`)
            expect((await response.json()).status === "ok", "body.status is not ok")
            return "200 ok"
        },
        { retry: true },
    )
    await check(
        "api /readyz (readiness: the database answers)",
        async () => {
            const response = await get(`${api}/readyz`)
            expect(response.status === 200, `HTTP ${response.status}`)
            return "200"
        },
        { retry: true },
    )
    await check(
        "api GraphQL { __typename }",
        async () => {
            const response = await get(`${api}/graphql`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: '{"query":"{__typename}"}',
            })
            expect(response.status === 200, `HTTP ${response.status}`)
            expect(JSON.stringify(await response.json()).includes("__typename"), "no __typename in the answer")
            return "200"
        },
        { retry: true },
    )
    await check(
        "web /health/live on the apex",
        async () => {
            const response = await get(`${web}/health/live`)
            expect(response.status === 200, `HTTP ${response.status}`)
            return "200"
        },
        { retry: true },
    )
    await check(
        "web /health/live on www",
        async () => {
            const response = await get(`${www}/health/live`)
            expect(response.status === 200, `HTTP ${response.status}`)
            return "200"
        },
        { retry: true },
    )
    await check(
        "legacy webhook path nivo.vn/healthz reaches the api",
        async () => {
            const response = await get(`${web}/healthz`)
            expect(response.status === 200, `HTTP ${response.status}`)
            return "200"
        },
        { retry: true },
    )
}

if (!args.includes("--skip-internal")) {
    const docker = (dockerArgs) => spawnSync("docker", dockerArgs, { encoding: "utf8", maxBuffer: 1 << 22 })
    const task = docker([
        "ps",
        "-q",
        "--filter",
        "label=com.docker.swarm.service.name=nivo_api",
        "--filter",
        "status=running",
    ])
        .stdout.split(/\r?\n/u)
        .find(Boolean)
    await check("an api task is running on this manager", async () => {
        expect(task, "no running container of nivo_api on the daemon")
        return task.slice(0, 12)
    })
    if (task) {
        await check("api reaches OpenClaw by service DNS (openclaw:18790)", async () => {
            const run = docker([
                "exec",
                task,
                "node",
                "-e",
                "fetch('http://openclaw:18790/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
            ])
            expect(run.status === 0, "the relay did not answer /health")
            return "ok"
        })
        await check("jobs watchdog prints exactly two non-negative integers", async () => {
            const run = docker(["exec", task, "node", "be/dist/apps/cli/src/main.js", "jobs", "watchdog"])
            expect(run.status === 0, `exit ${run.status}`)
            expect(/^\d+ \d+\r?\n?$/u.test(run.stdout), "stdout is not '<failed24h> <oldestQueuedAgeSeconds>'")
            return run.stdout.trim()
        })
    }
}

for (const result of results) process.stdout.write(`${result.ok ? "PASS" : "FAIL"}  ${result.name}  ${result.detail}\n`)
process.exit(results.every((result) => result.ok) ? 0 : 1)
