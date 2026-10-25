import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicLeadsService } from "@modules/domain/public-api"
import { markPublicApiBacklog, persistPublicApiLead } from "../../fixtures/builders/public-api.builder"
import * as statements from "../../fixtures/persistence/public-api.sql"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest, publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof, DEFAULT_NEED, RETAINED_NEED } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API need-presence (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, requestForLead } = preparePublicApiProof(world)

    it.each([
        { label: "omitted", need: undefined, backlog: false, expected: RETAINED_NEED, flag: false },
        { label: "empty", need: "", backlog: false, expected: RETAINED_NEED, flag: false },
        {
            label: "default text in the historical backlog",
            need: DEFAULT_NEED,
            backlog: true,
            expected: RETAINED_NEED,
            flag: null,
        },
        {
            label: "explicit default text with presence",
            need: DEFAULT_NEED,
            backlog: false,
            expected: DEFAULT_NEED,
            flag: true,
        },
    ])("applies the owner need rule for $label", async ({ need, backlog, expected, flag }) => {
        const identity = await fixture()
        const leadId = world.id()
        const externalId = world.id()
        await persistPublicApiLead(world.db.primary, identity.workspaceId, leadId)
        await world.resolve(PublicLeadsService).acceptLead({
            authorization: identity.authorization,
            name: "Existing API customer",
            email: `${leadId}@example.test`,
            need,
            externalId,
            company: "Updated company",
            note: "Keep the preferred support window",
            stage: "qualified",
        })
        const request = await requestForLead(identity.workspaceId, externalId)
        if (backlog) await markPublicApiBacklog(world.db.primary, identity.workspaceId, request.id)
        expect((await publicApiRequest(world, identity.workspaceId, request.id)).need_supplied).toBe(flag)
        const payload = { workspaceId: identity.workspaceId, requestId: request.id }
        await deliver(payload)
        const lead = await world.db.primary.query<Array<{ readonly need: string }>>(statements.API_LEAD, [
            identity.workspaceId,
            leadId,
        ])
        expect(lead).toEqual([
            expect.objectContaining({ need: expected, company: "Updated company", stage: "qualified" }),
        ])
        const committed = await publicApiRequest(world, identity.workspaceId, request.id)
        expect(committed.lead_id).toBe(leadId)
        expect(committed.processed_at).toBeInstanceOf(Date)
        const work = await publicApiWork(world, identity.workspaceId)
        const evidence = await world.db.primary.query<Array<object>>(statements.API_EVENTS, [identity.workspaceId])
        await deliver(payload)
        expect(await publicApiWork(world, identity.workspaceId)).toEqual(work)
        expect(await world.db.primary.query(statements.API_EVENTS, [identity.workspaceId])).toEqual(evidence)
    })
})
