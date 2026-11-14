#!/usr/bin/env node
// The guard of the provider-ring rule (2026-11-12, after the silent boot hang of build SEVEN): no Nest provider may reach itself
// through its injections. Nest 11 detects a direct two-provider ring and throws; a longer ring (A -> B -> C -> A, typically closed by
// a `{ provide: TOKEN, useExisting: A }` binding) makes the injector wait forever with no error. This check finds every ring.
//
//   npm run di-ring:check                                  scans be/dist (the build of `npm run build:be`)
//   node scripts/di-ring-check.mjs --dist <build dir> [--apps api,mcp,cli] [--verbose]
//   node scripts/di-ring-check.mjs --self-test             the fixture ring (the SEVEN shape) and its fixed twin
//   exit 0 = no ring; 1 = a ring (each printed as its ordered chain); 2 = the scan itself failed
//
// Static reflection over the COMPILED metadata only: it requires the built modules, calls each app's `AppModule.register(options)`
// with options parsed by the app's own env reader from a FAKE in-memory environment (never `process.env`, never a secret), and lets
// Nest's own `DependenciesScanner` register the module graph. The scanner only records metadata: no provider is instantiated, no
// factory runs, no database or network connection opens (sockets and DNS are refused while the check runs, so a module that tried
// would fail the check loudly). Edges read per provider: constructor parameter types (`design:paramtypes`) overridden by `@Inject`
// tokens (`self:paramtypes`), `@Optional` marks, `@Inject` properties, `useFactory` `inject` lists (optional entries included) and
// `useExisting` (an alias wrapper whose one injection is the target). A token is resolved to its provider with Nest's own lookup
// rule (the module's providers, then its imports, descending only through re-exported modules; global modules are bound to every
// module). A ring with a `forwardRef` edge is reported as a warning: Nest breaks it with a proxy.
//
// Blind spots: `moduleRef.get` / `resolve` at run time, request- and transient-scoped trees resolved per request, and modules an app
// composes only under an environment branch the fake environment does not take (the fake one declares every key the readers touch
// that it can satisfy, so optional integrations are ON).
import { createRequire } from "node:module"
import { existsSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BE = join(ROOT, "be")
const laneRequire = createRequire(join(ROOT, "package.json"))

/** The apps whose composition roots are scanned: AppModule, the env reader and its export. */
const APPS = {
    api: { module: "apps/api/src/app.module.js", reader: "apps/api/src/api.env.js", read: "readApiEnv" },
    mcp: { module: "apps/mcp/src/app.module.js", reader: "apps/mcp/src/mcp.env.js", read: "readMcpEnv" },
    cli: { module: "apps/cli/src/app.module.js", reader: "apps/cli/src/cli.env.js", read: "readCliEnv" },
}
const ENV_SOURCE = "src/modules/platform/config/index.js"

/** Values a fake key cycles through until the reader accepts it (none is a credential: placeholders of the right shape only). */
const FAKE_VALUES = [
    "http://localhost:1",
    "postgres://u:p@127.0.0.1:1/db",
    "1",
    "true",
    "development",
    "dev",
    Buffer.alloc(32, 1).toString("base64"),
    "a".repeat(64),
    "x".repeat(64),
    "localhost",
    "a@b.co",
    "info",
    "3999",
    Buffer.alloc(32, 1).toString("hex"),
    Buffer.alloc(64, 1).toString("base64"),
    "local",
    "test",
    "production",
    "s3",
    "debug",
    "0",
    "false",
    "10",
    "1000",
    "UTC",
    "Asia/Ho_Chi_Minh",
    "vi",
    "a,b",
    "[]",
    "{}",
    "redis://127.0.0.1:1",
    "https://localhost:1/x",
    process.platform === "win32" ? "C:/di-ring-check/absent.exe" : "/di-ring-check/absent",
]
const ENV_ROUNDS = 5000

// ---------------------------------------------------------------------------------------------------------------------------------
// No I/O beyond reading the build: every outbound socket and DNS lookup throws while the check runs.

const refuseNetwork = () => {
    const net = laneRequire("node:net")
    const dns = laneRequire("node:dns")
    const refuse = (what) => () => {
        throw new Error(`di-ring-check: ${what} refused (a module opened a connection while being scanned)`)
    }
    net.Socket.prototype.connect = refuse("socket connect")
    net.connect = refuse("net.connect")
    net.createConnection = refuse("net.createConnection")
    dns.lookup = refuse("dns.lookup")
    dns.resolve = refuse("dns.resolve")
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The graph: Nest's scanner registers the modules; the edges come from the compiled metadata.

const nest = () => {
    laneRequire("reflect-metadata")
    return {
        NestContainer: laneRequire("@nestjs/core/injector/container").NestContainer,
        DependenciesScanner: laneRequire("@nestjs/core/scanner").DependenciesScanner,
        MetadataScanner: laneRequire("@nestjs/core/metadata-scanner").MetadataScanner,
        GraphInspector: laneRequire("@nestjs/core/inspector/graph-inspector").GraphInspector,
        ApplicationConfig: laneRequire("@nestjs/core/application-config").ApplicationConfig,
        C: laneRequire("@nestjs/common/constants"),
    }
}

const tokenName = (token) => {
    if (typeof token === "function") return token.name || "<anonymous class>"
    if (typeof token === "symbol") return token.toString()
    return JSON.stringify(token)
}

/** A key per token identity: two tokens with one display name (a class and its string alias) stay two nodes. */
const tokenIds = new Map()
const tokenKey = (token) => {
    if (!tokenIds.has(token)) tokenIds.set(token, tokenIds.size)
    return `${tokenName(token)}#${tokenIds.get(token)}`
}

/** Nest's lookup (Injector.lookupComponent + lookupComponentInImports): own providers, then imports through re-exports. */
const lookup = (mod, token) => {
    if (mod.providers.has(token)) return mod
    const registry = new Set()
    const walk = (moduleRef, traversing) => {
        let children = [...moduleRef.imports].filter(Boolean)
        if (traversing) children = children.filter((child) => moduleRef.exports.has(child.metatype))
        for (const related of children) {
            if (registry.has(related.id)) continue
            registry.add(related.id)
            if (!related.exports.has(token) || !related.providers.has(token)) {
                const found = walk(related, true)
                if (found) return found
                continue
            }
            return related
        }
        return null
    }
    return walk(mod, false)
}

/** The injections of one provider wrapper: { token, how, optional, forward }. */
const injectionsOf = (wrapper, C) => {
    const unwrap = (raw) => {
        if (raw && typeof raw === "object" && typeof raw.forwardRef === "function")
            return { token: raw.forwardRef(), forward: true }
        return { token: raw, forward: false }
    }
    if (Array.isArray(wrapper.inject)) {
        const how = wrapper.isAlias ? "useExisting" : "useFactory inject"
        return wrapper.inject.map((item, index) => {
            const optionalObject = item && typeof item === "object" && "token" in item && !("forwardRef" in item)
            const { token, forward } = unwrap(optionalObject ? item.token : item)
            return {
                token,
                how: wrapper.isAlias ? how : `${how}[${index}]`,
                optional: optionalObject && item.optional === true,
                forward,
            }
        })
    }
    const type = wrapper.metatype
    if (typeof type !== "function" || (wrapper.inject !== null && wrapper.inject !== undefined)) return []
    const params = [...(Reflect.getMetadata(C.PARAMTYPES_METADATA, type) || [])]
    const declared = new Set()
    for (const { index, param } of Reflect.getMetadata(C.SELF_DECLARED_DEPS_METADATA, type) || []) {
        params[index] = param
        declared.add(index)
    }
    const optional = new Set(Reflect.getMetadata(C.OPTIONAL_DEPS_METADATA, type) || [])
    const found = params.map((raw, index) => {
        const { token, forward } = unwrap(raw)
        return {
            token,
            how: `${declared.has(index) ? "@Inject " : ""}constructor[${index}]`,
            optional: optional.has(index),
            forward,
        }
    })
    const optionalKeys = new Set(Reflect.getMetadata(C.OPTIONAL_PROPERTY_DEPS_METADATA, type) || [])
    for (const { key, type: raw } of Reflect.getMetadata(C.PROPERTY_DEPS_METADATA, type) || []) {
        const { token, forward } = unwrap(raw)
        found.push({ token, how: `@Inject property ${String(key)}`, optional: optionalKeys.has(key), forward })
    }
    return found
}

/** Registers the module graph of a root module definition (static or dynamic) without instantiating anything. */
const scanModules = async (root) => {
    const { NestContainer, DependenciesScanner, MetadataScanner, GraphInspector, ApplicationConfig } = nest()
    const config = new ApplicationConfig()
    const container = new NestContainer(config)
    const scanner = new DependenciesScanner(container, new MetadataScanner(), new GraphInspector(container), config)
    await scanner.scan(root)
    return [...container.getModules().values()]
}

/** The provider graph: nodes keyed `module#n::token`, edges with how they were declared. */
const providerGraph = (modules) => {
    const { C } = nest()
    const counts = new Map()
    for (const mod of modules) counts.set(mod.name, (counts.get(mod.name) ?? 0) + 1)
    const moduleLabel = new Map()
    const seen = new Map()
    for (const mod of modules) {
        const n = (seen.get(mod.name) ?? 0) + 1
        seen.set(mod.name, n)
        moduleLabel.set(mod, counts.get(mod.name) > 1 ? `${mod.name}#${n}` : mod.name)
    }
    const nodes = new Map()
    const keyOf = (mod, token) => `${moduleLabel.get(mod)}::${tokenKey(token)}`
    const unresolved = []
    let edges = 0
    for (const mod of modules) {
        for (const [token, wrapper] of mod.providers) {
            const key = keyOf(mod, token)
            nodes.set(key, {
                key,
                token,
                module: moduleLabel.get(mod),
                moduleType: mod.metatype,
                wrapper,
                scope: wrapper.scope,
                edges: [],
            })
        }
    }
    for (const mod of modules) {
        for (const [token, wrapper] of mod.providers) {
            const node = nodes.get(keyOf(mod, token))
            for (const injection of injectionsOf(wrapper, C)) {
                if (injection.token === undefined || injection.token === Object) {
                    unresolved.push(
                        `${node.key} ${injection.how}: no type (an import ring between files, or a missing @Inject)`,
                    )
                    continue
                }
                const host = lookup(mod, injection.token)
                if (!host) {
                    if (!injection.optional)
                        unresolved.push(`${node.key} ${injection.how}: ${tokenName(injection.token)} not provided`)
                    continue
                }
                node.edges.push({ to: keyOf(host, injection.token), ...injection })
                edges++
            }
        }
    }
    return { nodes, edges, unresolved, modules: modules.length }
}

/** Tarjan's strongly connected components; a component of two or more (or a self edge) is a ring. */
const ringsOf = (nodes) => {
    let index = 0
    const stack = []
    const info = new Map()
    const components = []
    const visit = (start) => {
        // Iterative: the provider graph is deep enough to overflow a recursive walk.
        const work = [{ v: start, i: 0 }]
        info.set(start, { index, low: index, on: true })
        index++
        stack.push(start)
        while (work.length > 0) {
            const frame = work[work.length - 1]
            const edgesOut = nodes.get(frame.v).edges
            if (frame.i < edgesOut.length) {
                const w = edgesOut[frame.i++].to
                if (!nodes.has(w)) continue
                if (!info.has(w)) {
                    info.set(w, { index, low: index, on: true })
                    index++
                    stack.push(w)
                    work.push({ v: w, i: 0 })
                } else if (info.get(w).on) info.get(frame.v).low = Math.min(info.get(frame.v).low, info.get(w).index)
                continue
            }
            work.pop()
            const mine = info.get(frame.v)
            if (work.length > 0) {
                const parent = info.get(work[work.length - 1].v)
                parent.low = Math.min(parent.low, mine.low)
            }
            if (mine.low === mine.index) {
                const component = []
                let w
                do {
                    w = stack.pop()
                    info.get(w).on = false
                    component.push(w)
                } while (w !== frame.v)
                const self = nodes.get(frame.v).edges.some((edge) => edge.to === frame.v)
                if (component.length > 1 || self) components.push(component)
            }
        }
    }
    for (const key of nodes.keys()) if (!info.has(key)) visit(key)
    return components.map((component) => {
        const members = new Set(component)
        const start = [...members].sort()[0]
        // The shortest ordered chain from the first member back to itself, inside the component.
        const previous = new Map()
        const queue = [start]
        let closing = null
        while (queue.length > 0 && closing === null) {
            const v = queue.shift()
            for (const edge of nodes.get(v).edges) {
                if (!members.has(edge.to)) continue
                if (edge.to === start) {
                    closing = { from: v, edge }
                    break
                }
                if (!previous.has(edge.to)) {
                    previous.set(edge.to, { from: v, edge })
                    queue.push(edge.to)
                }
            }
        }
        const chain = [closing]
        for (let at = closing.from; at !== start; at = previous.get(at).from) chain.unshift(previous.get(at))
        const forwardBroken = chain.some((step) => step.edge.forward)
        return { members: [...members], chain: chain.map((step) => ({ from: step.from, ...step.edge })), forwardBroken }
    })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Where a provider is written: the compiled file that exports its class (mapped back to its source), for the report.

const sourceIndex = (dist) => {
    const index = new Map()
    for (const [file, cached] of Object.entries(laneRequire.cache)) {
        if (!file.startsWith(dist + sep) || !cached?.exports) continue
        for (const value of Object.values(cached.exports)) {
            // The file that declares it, not a barrel (`index.js`) that re-exports it.
            if (typeof value === "function" && (!index.has(value) || /[\\/]index\.js$/u.test(index.get(value))))
                index.set(value, file)
        }
    }
    return (token) => {
        const file = index.get(token)
        if (!file) return null
        const source = join(BE, relative(dist, file)).replace(/\.js$/u, ".ts")
        return relative(ROOT, existsSync(source) ? source : file)
            .split(sep)
            .join("/")
    }
}

const describeRing = (ring, nodes, where) => {
    const lines = [
        `${ring.forwardBroken ? "WARN ring broken by forwardRef" : "RING"} (${ring.members.length} providers):`,
    ]
    for (const step of ring.chain) {
        const from = nodes.get(step.from)
        const type = from.wrapper.metatype && from.wrapper.metatype.prototype ? from.wrapper.metatype : from.token
        const file = where(type) ?? where(from.token) ?? where(from.moduleType)
        const flags = [
            step.optional ? "optional" : "",
            step.forward ? "forwardRef" : "",
            from.scope ? `scope ${from.scope}` : "",
        ]
            .filter(Boolean)
            .join(", ")
        lines.push(`  ${tokenName(from.token)} [${from.module}]${file ? ` (${file})` : ""}`)
        lines.push(`    --${step.how}${flags ? ` (${flags})` : ""}--> ${tokenName(nodes.get(step.to).token)}`)
    }
    return lines.join("\n")
}

// ---------------------------------------------------------------------------------------------------------------------------------
// A fake environment the app's own reader accepts, with every key it touches declared where a fake value satisfies it.

const fakeOptions = (EnvSource, read) => {
    const env = {}
    const tried = {}
    const touched = new Set()
    const dropped = new Set()
    for (let round = 0; round < ENV_ROUNDS; round++) {
        const recent = []
        const source = new EnvSource({ ...env })
        const recorder = new Proxy(source, {
            get: (target, property) => {
                const member = target[property]
                if (typeof member !== "function") return member
                return (...args) => {
                    // The keys are the first argument (one key, or the list of `anyDeclared`); later arguments are fallbacks.
                    const keys = Array.isArray(args[0]) ? args[0] : [args[0]]
                    for (const key of keys) {
                        if (typeof key === "string") {
                            recent.push(key)
                            touched.add(key)
                        }
                    }
                    return member.apply(target, args)
                }
            },
        })
        let options = null
        let failure = null
        try {
            options = read(recorder)
        } catch (error) {
            failure = error
        }
        if (options !== null) {
            // Accepted: switch on the next touched key not yet declared (an optional integration), or stop.
            const next = [...touched].find((key) => env[key] === undefined && !dropped.has(key))
            if (next === undefined) return { options, keys: Object.keys(env).length }
            tried[next] = 0
            env[next] = FAKE_VALUES[0]
            continue
        }
        // The key the error names (`params.key`, or any param that is a key the reader touched), else the last key read.
        const named = Object.values(failure?.params ?? {}).find(
            (value) => typeof value === "string" && touched.has(value),
        )
        const key = failure?.params?.key ?? named ?? recent[recent.length - 1]
        if (typeof key !== "string") throw failure
        const nextValue = (tried[key] ?? -1) + 1
        if (nextValue >= FAKE_VALUES.length) {
            if (env[key] === undefined || dropped.has(key)) throw failure
            // No fake value satisfies an optional key: leave it undeclared.
            delete env[key]
            dropped.add(key)
            continue
        }
        tried[key] = nextValue
        env[key] = FAKE_VALUES[nextValue]
    }
    throw new Error("di-ring-check: the env reader never accepted a fake environment")
}

// ---------------------------------------------------------------------------------------------------------------------------------

const scanApp = async (dist, name, verbose) => {
    const app = APPS[name]
    const { EnvSource } = laneRequire(join(dist, ENV_SOURCE))
    const read = laneRequire(join(dist, app.reader))[app.read]
    const { AppModule } = laneRequire(join(dist, app.module))
    const { options, keys } = fakeOptions(EnvSource, read)
    const modules = await scanModules(AppModule.register(options))
    const graph = providerGraph(modules)
    const rings = ringsOf(graph.nodes)
    const where = sourceIndex(dist)
    const header =
        `${name}: ${graph.modules} modules, ${graph.nodes.size} providers, ${graph.edges} injection edges, ` +
        `${graph.unresolved.length} unresolved (fake env ${keys} keys)`
    const lines = [header]
    if (graph.unresolved.length > 0) {
        lines.push(
            `  ${graph.unresolved.length} injections unresolved (not rings; Nest would throw at boot, not hang):`,
        )
        for (const line of verbose ? graph.unresolved : graph.unresolved.slice(0, 10)) lines.push(`    ${line}`)
        if (!verbose && graph.unresolved.length > 10) lines.push("    ... (--verbose lists all)")
    }
    for (const ring of rings) lines.push(describeRing(ring, graph.nodes, where))
    const hard = rings.filter((ring) => !ring.forwardBroken).length
    lines.push(
        `  ${name}: ${hard === 0 ? "no provider ring" : `${hard} provider ring(s)`}${rings.length > hard ? `, ${rings.length - hard} forwardRef warning(s)` : ""}`,
    )
    return { text: lines.join("\n"), hard }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Self-test: the SEVEN shape (two global modules; A -> optional B -> optional PORT, PORT = useExisting A) must be found; its fix
// (PORT on its own provider) must pass; a useFactory inject ring must be found; a ring broken by forwardRef is only a warning.

const selfTest = async () => {
    const { Module, Injectable, Inject, Optional, Global, forwardRef } = laneRequire("@nestjs/common")
    const PORT = Symbol("PROVIDER_TRIGGER_CORE_DECIDERS")
    const declare = (cls, params) => {
        Reflect.defineMetadata("design:paramtypes", params, cls)
        Injectable()(cls)
        return cls
    }
    class ProviderTriggersService {}
    class BankFeedTriggerService {}
    class BankFeedCoreDeciderService {}
    class AgentBindingsService {}
    declare(ProviderTriggersService, [Object])
    Optional()(ProviderTriggersService, undefined, 0)
    Inject(PORT)(ProviderTriggersService, undefined, 0)
    declare(BankFeedTriggerService, [ProviderTriggersService, BankFeedCoreDeciderService])
    Optional()(BankFeedTriggerService, undefined, 0)
    declare(BankFeedCoreDeciderService, [AgentBindingsService])
    declare(AgentBindingsService, [])
    const root = (fixed) => {
        class BillingModule {}
        class ProviderTriggersModule {}
        class AgentsModule {}
        class AppModule {}
        Global()(AgentsModule)
        Module({ providers: [AgentBindingsService], exports: [AgentBindingsService] })(AgentsModule)
        Global()(BillingModule)
        Module({
            providers: [
                BankFeedTriggerService,
                BankFeedCoreDeciderService,
                { provide: PORT, useExisting: fixed ? BankFeedCoreDeciderService : BankFeedTriggerService },
            ],
            exports: [PORT],
        })(BillingModule)
        Global()(ProviderTriggersModule)
        Module({ providers: [ProviderTriggersService], exports: [ProviderTriggersService] })(ProviderTriggersModule)
        Module({ imports: [AgentsModule, BillingModule, ProviderTriggersModule] })(AppModule)
        return AppModule
    }
    const FACTORY = "FACTORY_TOKEN"
    class Consumer {}
    declare(Consumer, [Object])
    Inject(FACTORY)(Consumer, undefined, 0)
    const factoryRoot = () => {
        class FactoryModule {}
        Module({
            providers: [
                Consumer,
                { provide: FACTORY, useFactory: () => ({}), inject: [{ token: Consumer, optional: true }] },
            ],
        })(FactoryModule)
        return FactoryModule
    }
    class Left {}
    class Right {}
    declare(Left, [Object])
    Inject(forwardRef(() => Right))(Left, undefined, 0)
    declare(Right, [Left])
    const forwardRoot = () => {
        class ForwardModule {}
        Module({ providers: [Left, Right] })(ForwardModule)
        return ForwardModule
    }
    const ringsIn = async (module) => {
        const graph = providerGraph(await scanModules(module))
        return { graph, rings: ringsOf(graph.nodes) }
    }
    const failures = []
    const broken = await ringsIn(root(false))
    const names = (ring) =>
        ring.chain
            .map((step) => tokenName(broken.graph.nodes.get(step.from).token))
            .sort()
            .join(",")
    const want = ["BankFeedTriggerService", "ProviderTriggersService", PORT.toString()].sort().join(",")
    if (broken.rings.length !== 1 || broken.rings[0].forwardBroken || names(broken.rings[0]) !== want)
        failures.push(`SEVEN shape: want one ring ${want}, got ${JSON.stringify(broken.rings.map(names))}`)
    else if (!broken.rings[0].chain.some((step) => step.how === "useExisting"))
        failures.push("SEVEN shape: the ring does not name its useExisting edge")
    const fixed = await ringsIn(root(true))
    if (fixed.rings.length !== 0) failures.push(`fixed shape: want no ring, got ${fixed.rings.length}`)
    const factory = await ringsIn(factoryRoot())
    if (factory.rings.length !== 1 || factory.rings[0].forwardBroken) failures.push("useFactory inject ring: not found")
    const forward = await ringsIn(forwardRoot())
    if (forward.rings.length !== 1 || !forward.rings[0].forwardBroken)
        failures.push("forwardRef ring: want one warning")
    return failures.length === 0 ? null : `di-ring-check: self-test FAIL\n  ${failures.join("\n  ")}`
}

// ---------------------------------------------------------------------------------------------------------------------------------

const argOf = (flag) => {
    const at = process.argv.indexOf(flag)
    return at === -1 ? undefined : process.argv[at + 1]
}

const main = async () => {
    refuseNetwork()
    const failed = await selfTest()
    if (process.argv.includes("--self-test")) {
        process.stdout.write(failed === null ? "di-ring-check: self-test PASS\n" : `${failed}\n`)
        return failed === null ? 0 : 1
    }
    if (failed !== null) {
        process.stderr.write(`${failed}\n`)
        return 2
    }
    const given = argOf("--dist") ?? join(BE, "dist")
    const dist = resolve(isAbsolute(given) ? given : join(process.cwd(), given))
    if (!existsSync(dist) || !statSync(dist).isDirectory()) {
        process.stderr.write(`di-ring-check: no build at ${dist} (npm run build:be, or --dist <dir>)\n`)
        return 2
    }
    // A build emitted outside the repository resolves its packages from the repository's node_modules.
    const fromRoot = relative(ROOT, dist)
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
        laneRequire("node:module").registerHooks({
            resolve: (specifier, context, nextResolve) => {
                try {
                    return nextResolve(specifier, context)
                } catch (error) {
                    if (specifier.startsWith(".") || isAbsolute(specifier) || specifier.startsWith("node:")) throw error
                    return { url: pathToFileURL(laneRequire.resolve(specifier)).href, shortCircuit: true }
                }
            },
        })
    }
    const apps = (argOf("--apps") ?? Object.keys(APPS).join(",")).split(",").filter(Boolean)
    let rings = 0
    for (const name of apps) {
        if (!APPS[name]) {
            process.stderr.write(`di-ring-check: unknown app ${name} (${Object.keys(APPS).join(", ")})\n`)
            return 2
        }
        const result = await scanApp(dist, name, process.argv.includes("--verbose"))
        process.stdout.write(`${result.text}\n`)
        rings += result.hard
    }
    process.stdout.write(
        rings === 0
            ? `di-ring-check: PASS (${apps.join(", ")}; build ${dist})\n`
            : `di-ring-check: FAIL, ${rings} provider ring(s)\n`,
    )
    return rings === 0 ? 0 : 1
}

main().then(
    (code) => process.exit(code),
    (error) => {
        process.stderr.write(`di-ring-check: the scan failed: ${error?.stack ?? error}\n`)
        process.exit(2)
    },
)
