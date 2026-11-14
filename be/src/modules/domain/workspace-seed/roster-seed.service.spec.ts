import { mock } from "@starci/jest-preset"
import type { InstalledPlugin } from "@nivo-lite/agent-sdk/installation"
import { latestTemplateVersion, type TemplateAgent } from "@nivo-lite/agent-sdk/template"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { EnterpriseRosterSeat } from "@modules/domain/channel-provisioning"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { INSTALLED, customerChannelProviders, inboundChannelsOf } from "@modules/domain/installed-plugins"
import { AgentAccountsService, type TemplateProposal } from "@modules/domain/tools"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { GraphSeedService, type GraphSeedEntry } from "./graph-seed.service"
import { attachPlanOf, frontDoorsOf, rosterOf } from "./roster-seed.policy"
import { RosterSeedService } from "./roster-seed.service"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/**
 * The roster seed of an enterprise (ruling R17), on the REAL installation: the private plugin that names the enterprise (`nivo-web`)
 * brings its template agents; each is seeded with its installed primary graph and its accounts BY KIND; customer channels get their front
 * door. The writers (the graph seed, the attachments, the bindings) are the real classes' doors, mocked here: what they receive is the proof.
 */
const IDENTIFIER = "nivo-web"
const SEAT: EnterpriseRosterSeat = { workspaceId: "ws-web", ownerId: "owner-1", identifier: IDENTIFIER, place: "local" }

/** The installed roster of the enterprise, as the policy reads it. */
const ROSTER = rosterOf(INSTALLED.plugins, INSTALLED.templateAgents(), IDENTIFIER)

/** One working account of a kind, as the module's proposal lists it. */
const line = (provider: string, connectionId: string | null): TemplateProposal => ({
    provider,
    connectionId,
    accountLabel: connectionId,
    connected: connectionId !== null,
})

const account = (id: string, provider: ConnectionRecord["provider"], sandbox = false): ConnectionRecord =>
    connectionRecord({ id, workspaceId: SEAT.workspaceId, provider, name: id, sandbox })

/** A Zalo OA front-door channel, a live and a sandbox iNET account, a sandbox MISA account. */
const CONNECTIONS: ReadonlyArray<ConnectionRecord> = [
    account("c-zalo", "zalo_oa"),
    account("c-inet", "inet"),
    account("c-inet-sbx", "inet", true),
    account("c-misa-sbx", "misa_meinvoice", true),
]

/** The proposal of a module: its template's kinds, each with the workspace's accounts of that kind. */
const proposalOf = (moduleKey: string): ReadonlyArray<TemplateProposal> => {
    const agent = INSTALLED.templateAgentOf(moduleKey)
    return (agent?.accounts ?? []).flatMap((kind): ReadonlyArray<TemplateProposal> => {
        const held = CONNECTIONS.filter((connection) => connection.provider === kind)
        return held.length === 0 ? [line(kind, null)] : held.map((connection) => line(kind, connection.id))
    })
}

const build = (options: { readonly changed?: boolean; readonly owner?: string | null; readonly place?: "local" | "prod" } = {}) => {
    const printed: Array<string> = []
    const graphs = mock<GraphSeedService>()
    graphs.seedInto.mockImplementation((_workspace: string, entries: ReadonlyArray<GraphSeedEntry>) =>
        Promise.resolve(
            entries.map((entry) => ({ moduleKey: entry.spec.moduleKey, agentId: `agent-${entry.spec.moduleKey}`, changed: options.changed ?? true })),
        ),
    )
    const connections = mock<ConnectionsService>()
    connections.list.mockResolvedValue(CONNECTIONS)
    const abilities = mock<AgentAccountsService>()
    abilities.templateProposal.mockImplementation((_workspace: string, moduleKey: string) => Promise.resolve(proposalOf(moduleKey)))
    const bindings = mock<AgentBindingsService>()
    bindings.owningAgentOf.mockResolvedValue(options.owner ?? null)
    bindings.grant.mockResolvedValue(undefined)
    const seedOptions = { print: (text: string) => printed.push(text) } as unknown as WorkspaceSeedOptions
    const service = new RosterSeedService(seedOptions, graphs, connections, abilities, bindings)
    return { service, graphs, bindings, printed, seat: { ...SEAT, place: options.place ?? "local" } }
}

/** The entries the graph seed was handed. */
const entriesOf = (graphs: ReturnType<typeof build>["graphs"]): ReadonlyArray<GraphSeedEntry> => graphs.seedInto.mock.calls[0]?.[1] ?? []

describe("the roster of an enterprise (read from what its plugins declare)", () => {
    it("is every template agent of the private plugin that names the enterprise, in its order; nothing for another enterprise", () => {
        const plugin = INSTALLED.plugins.find((one) => one.visibility === "private" && one.enterprises.includes(IDENTIFIER))
        expect(plugin).toBeDefined()
        expect(ROSTER.map((agent) => agent.key)).toEqual(INSTALLED.templateAgents().filter((agent) => plugin?.modules.includes(agent.key)).map((agent) => agent.key))
        expect(ROSTER.map((agent) => agent.key)).toEqual(["webmail", "webdocs", "webdesk", "webrenew", "webbooks", "websales"])
        expect(rosterOf(INSTALLED.plugins, INSTALLED.templateAgents(), "other-enterprise")).toEqual([])
    })

    it("never takes a public plugin's agents into an enterprise roster", () => {
        const publicPlugin: InstalledPlugin = { key: "p", packageName: null, label: { vi: "p", en: "p" }, visibility: "public", enterprises: [IDENTIFIER], modules: ["m"], providers: [] }
        const agent = { key: "m" } as unknown as TemplateAgent
        expect(rosterOf([publicPlugin], [agent], IDENTIFIER)).toEqual([])
    })
})

describe("the attach rule by kind", () => {
    const sandbox = (id: string): boolean => id.endsWith("-sbx")

    it("takes the live accounts of a kind; sandbox ones only where no live one exists and only on the local stack; reports a kind with none", () => {
        const lines = [line("inet", "c-inet"), line("inet", "c-inet-sbx"), line("misa_meinvoice", "c-misa-sbx"), line("tino", null)]

        expect(attachPlanOf(lines, sandbox, "local")).toEqual({
            wishes: [{ connectionId: "c-inet" }, { connectionId: "c-misa-sbx" }],
            missing: ["tino"],
        })
        expect(attachPlanOf(lines, sandbox, "prod")).toEqual({ wishes: [{ connectionId: "c-inet" }], missing: ["misa_meinvoice", "tino"] })
    })

    it("names the first roster agent that answers a channel its front door, for the channels a customer writes on", () => {
        const doors = frontDoorsOf(ROSTER, customerChannelProviders())
        for (const [channel, key] of doors) {
            const first = ROSTER.find((agent) => inboundChannelsOf(agent).has(channel))
            expect([channel, key]).toEqual([channel, first?.key])
        }
        expect([...doors.keys()].every((channel) => customerChannelProviders().has(channel))).toBe(true)
    })
})

describe("RosterSeedService.install", () => {
    it("seeds every roster agent with its installed primary graph and its accounts by kind; a missing kind is printed, not fatal", async () => {
        const { service, graphs, printed, seat } = build()

        await expect(service.install(seat)).resolves.toBe(true)

        const entries = entriesOf(graphs)
        expect(graphs.seedInto.mock.calls[0]?.[0]).toBe(SEAT.workspaceId)
        expect(entries.map((entry) => entry.spec.moduleKey)).toEqual(ROSTER.map((agent) => agent.key))
        for (const entry of entries) {
            const primary = INSTALLED.templatesOf(entry.spec.moduleKey).find((template) => template.primary)
            if (primary === undefined) throw new Error(`no primary of ${entry.spec.moduleKey}`)
            // Exactly the graph installing the template agent publishes as its primary workflow (what `seeds:graphs` writes for NIVO).
            expect(entry.spec).toEqual(JSON.parse(JSON.stringify(latestTemplateVersion(primary).graph)))
            const kinds = INSTALLED.templateAgentOf(entry.spec.moduleKey)?.accounts ?? []
            const wished = (entry.wishes ?? []).map((wish) => wish.connectionId)
            // A live iNET account wins over the sandbox one; MISA has only a sandbox account: on the local stack it is attached.
            if (kinds.includes("inet")) expect(wished).toContain("c-inet")
            expect(wished).not.toContain("c-inet-sbx")
            if (kinds.includes("misa_meinvoice")) expect(wished).toContain("c-misa-sbx")
        }
        const missing = printed.filter((text) => text.includes("no usable account connected"))
        expect(missing.length).toBeGreaterThan(0)
    })

    it("binds a customer channel with no answering agent to its front door; keeps one an agent already answers", async () => {
        const doors = frontDoorsOf(ROSTER, customerChannelProviders())
        const door = doors.get("zalo_oa")
        expect(door).toBe("webdesk")
        const fresh = build()
        await fresh.service.install(fresh.seat)
        expect(fresh.bindings.grant.mock.calls).toEqual([
            ["owner-1", { workspaceId: SEAT.workspaceId, agentId: "agent-webdesk", connectionId: "c-zalo", purpose: "inbound_chat" }],
        ])

        const owned = build({ owner: "agent-somebody" })
        await owned.service.install(owned.seat)
        expect(owned.bindings.grant).not.toHaveBeenCalled()
    })

    it("IDEMPOTENT: a second run whose graph seed changes nothing and whose channels are answered changes nothing", async () => {
        const again = build({ changed: false, owner: "agent-webdesk" })

        await expect(again.service.install(again.seat)).resolves.toBe(false)
        expect(again.bindings.grant).not.toHaveBeenCalled()
    })

    it("in production never attaches a sandbox account", async () => {
        const { service, graphs, seat } = build({ place: "prod" })

        await service.install(seat)

        const wished = entriesOf(graphs).flatMap((entry) => (entry.wishes ?? []).map((wish) => wish.connectionId))
        expect(wished.filter((id) => id.endsWith("-sbx"))).toEqual([])
    })

    it("an enterprise no plugin declares a roster for writes nothing and says so", async () => {
        const { service, graphs, printed } = build()

        await expect(service.install({ ...SEAT, identifier: "other-enterprise" })).resolves.toBe(false)

        expect(graphs.seedInto).not.toHaveBeenCalled()
        expect(printed).toEqual(["other-enterprise: no plugin declares a roster for this enterprise"])
    })
})
