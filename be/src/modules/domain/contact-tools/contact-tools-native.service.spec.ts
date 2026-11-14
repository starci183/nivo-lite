import { mock } from "@starci/jest-preset"
import { CONTACTS_WORKSPACE as WS, MemoryContactMemory, MemoryContactsStore } from "@tests/fixtures/builders/contacts.builder"
import { connectionStatusOf } from "@tests/fixtures/builders/customer-link-native.builder"
import { ContactsService, ConversationContactsService } from "@modules/domain/contacts"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { NativeCaller } from "@modules/domain/tools"
import { NativeViewService } from "@modules/domain/native-tools/native-view.service"
import type { NativeView } from "@modules/domain/native-tools/native-view.policy"
import { ContactToolsNativeService } from "./contact-tools-native.service"

const NOW = new Date("2026-11-13T08:00:00.000Z")
const CONV = "c0000000-0000-4000-8000-000000000001"
const ACCOUNT = "8f8f2c1e-0000-4000-8000-00000000c001"

const build = (audience: NativeView["audience"] = "customer") => {
    const store = new MemoryContactsStore()
    const memory = new MemoryContactMemory()
    const contacts = new ContactsService(store, { now: () => NOW }, memory)
    const conversations = mock<ConversationContactsService>()
    const views = mock<NativeViewService>()
    views.of.mockResolvedValue({ workspaceId: WS, module: "sales", audience, installationId: null, searchable: true })
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.ofProvider.mockResolvedValue([connectionStatusOf({ id: ACCOUNT })])
    const tools = new ContactToolsNativeService(contacts, conversations, views, bindings, { now: () => NOW })
    return { store, memory, contacts, conversations, tools }
}

const customerRun = (contactId: string): NativeCaller => ({
    agentId: "agent-1",
    conversationId: CONV,
    graphStep: true,
    run: { turnId: "run-1", locale: "vi", origin: "customer", memberId: null, handedOffBy: null, contactId, leadId: null, stepTools: [] },
})

const internalStep = (approvedBy?: string): NativeCaller & { readonly approvedBy?: string } => ({
    agentId: "agent-1",
    conversationId: null,
    graphStep: true,
    ...(approvedBy === undefined ? {} : { approvedBy }),
})

describe("ContactToolsNativeService: nivo.tool.contact.get", () => {
    it("reads the run's own contact with identities masked for a customer-facing run, and the memory", async () => {
        const { store, memory, tools } = build("customer")
        const lan = store.seed(WS, "Lan", [{ kind: "phone", provider: "", account: "", value: "84912345678", proof: "token" }])
        await memory.remember(WS, lan, { address: "12 L\u00ea L\u1ee3i" })
        const answer = await tools.invoke(WS, "get", { contactId: lan }, customerRun(lan))
        expect(answer).toMatchObject({
            source: "nivo.contact",
            facts: [{ id: lan, name: "Lan", phones: ["84\u2022\u2022\u2022\u2022\u20225678"], memory: { address: "12 L\u00ea L\u1ee3i" } }],
        })
    })

    it("shows the identities to an internal run", async () => {
        const { store, tools } = build("internal")
        const lan = store.seed(WS, "Lan", [{ kind: "email", provider: "", account: "", value: "lan@gmail.com", proof: "member" }])
        await expect(tools.invoke(WS, "get", {}, customerRun(lan))).resolves.toMatchObject({ facts: [{ emails: ["lan@gmail.com"] }] })
    })
})

describe("ContactToolsNativeService: writes about a person", () => {
    it("refuses a customer-facing run that names another contact (other_contact)", async () => {
        const { store, tools } = build()
        const lan = store.seed(WS, "Lan")
        const other = store.seed(WS, "Mai")
        await expect(tools.invoke(WS, "update", { contactId: other, tags: ["vip"] }, customerRun(lan))).rejects.toMatchObject({
            params: { reason: "other_contact" },
        })
        await expect(tools.invoke(WS, "update", { tags: ["vip"] }, customerRun(lan))).resolves.toEqual({ updated: true, contactId: lan })
    })

    it("remembers facts on the run's contact", async () => {
        const { store, memory, tools } = build()
        const lan = store.seed(WS, "Lan")
        await expect(tools.invoke(WS, "memory.remember", { facts: { address: "1 Le Loi" } }, customerRun(lan))).resolves.toEqual({
            remembered: ["address"],
            contactId: lan,
        })
        await expect(memory.read(WS, lan)).resolves.toMatchObject({ facts: { address: "1 Le Loi" } })
    })

    it("remembers a fact as its own copy: changing the asked value afterwards leaves the memory as it was", async () => {
        const { store, memory, tools } = build()
        const lan = store.seed(WS, "Lan")
        const asked = { address: { street: "1 Le Loi", city: "Hue" } }
        await tools.invoke(WS, "memory.remember", { facts: asked }, customerRun(lan))
        asked.address.city = "Hanoi"

        await expect(memory.read(WS, lan)).resolves.toMatchObject({ facts: { address: { street: "1 Le Loi", city: "Hue" } } })
    })

    it("keeps a phone the person only said as a proposal; a person's approval verifies it", async () => {
        const { store, tools } = build()
        const lan = store.seed(WS, "Lan")
        await expect(tools.invoke(WS, "identity.link", { kind: "phone", value: "0912345678" }, customerRun(lan))).resolves.toMatchObject({
            outcome: "proposed",
            identity: { verified: false },
        })
        const approved = { ...customerRun(lan), approvedBy: "member-1" }
        await expect(tools.invoke(WS, "identity.link", { kind: "phone", value: "0912345678" }, approved)).resolves.toMatchObject({
            outcome: "linked",
            identity: { verified: true },
        })
    })

    it("links an outside customer id only from an internal step a person approved, on an account the workspace holds", async () => {
        const { store, tools } = build("internal")
        const lan = store.seed(WS, "Lan")
        const external = { contactId: lan, kind: "external", value: "ACME" }
        await expect(tools.invoke(WS, "identity.link", external, customerRun(lan))).rejects.toMatchObject({ params: { reason: "internal_only" } })
        await expect(tools.invoke(WS, "identity.link", external, internalStep())).rejects.toMatchObject({ params: { reason: "ask_only" } })
        await expect(tools.invoke(WS, "identity.link", external, internalStep("member-1"))).resolves.toMatchObject({ outcome: "linked" })
        await expect(
            tools.invoke(WS, "identity.link", { ...external, account: "8f8f2c1e-0000-4000-8000-0000000000ff" }, internalStep("member-1")),
        ).rejects.toMatchObject({ params: { reason: "account_missing" } })
    })

    it("merges only on a person's decision; integrity refusals are answered", async () => {
        const { store, tools } = build("internal")
        const a = store.seed(WS, "Lan")
        const b = store.seed(WS, "Lan")
        await expect(tools.invoke(WS, "merge", { intoContactId: a, fromContactId: b }, internalStep())).rejects.toMatchObject({
            params: { reason: "no_proof" },
        })
        await expect(tools.invoke(WS, "merge", { intoContactId: a, fromContactId: a }, internalStep("m"))).rejects.toMatchObject({
            params: { reason: "same_contact" },
        })
        await expect(tools.invoke(WS, "merge", { intoContactId: a, fromContactId: b }, internalStep("m"))).resolves.toEqual({
            merged: true,
            contactId: a,
            reason: "member_approved",
        })
    })
})
