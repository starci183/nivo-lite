import assert from "node:assert/strict"
import { SEPAY_DELIVERY_QUEUE } from "@modules/queues/sepay-delivery"
import { SepayDeliveryQueueModule } from "@features/jobs/sepay-delivery"
import { deliveryJobBuilder, persistDeliveryWorkspace } from "../../world/delivery-jobs-proof.service"
import { deliveryCapabilities } from "../../world/delivery-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"
import { jobSnapshot } from "../../world/proof-database.service"
import { refuseNextDeliveryTransaction } from "../../world/delivery-failure.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import type { LiteWorld } from "../../world/lite-world.service"
import { registerDeliveryProcessor } from "../../world/delivery-registration.service"
import type { RegisteredDelivery } from "../../world/delivery-registration.service"

type ResolveDelivery = () => RegisteredDelivery
type BuildDelivery = () => ReturnType<typeof deliveryJobBuilder>

const registerValidation = (world: LiteWorld, build: BuildDelivery): void => {
    it("advances the live claim before consuming its committed receipt", async () => {
        const { processor, inbox, progress, job, advance, state, delivery } = await build()
        progress.advance.mockImplementation(async (write) => {
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
            await advance(write)
            expect((await state()).receipts[0]?.processed_at).toBeNull()
            expect(await jobSnapshot(world.db.primary, delivery.id)).toMatchObject({ current_step: "sepay-delivery" })
        })
        await processor.process(job)
        expect(processor.queue).toBe(SEPAY_DELIVERY_QUEUE)
        expect(progress.advance).toHaveBeenCalledWith({
            jobId: job.jobId,
            expectedFencingToken: 3,
            step: "sepay-delivery",
        })
        expect(inbox.processRecordedDelivery).toHaveBeenCalledWith(job.payload)
        expect((await state()).receipts[0]?.processed_at).toBeInstanceOf(Date)
    })

    it.each([{}, { deliveryId: "" }, { deliveryId: "   " }, { deliveryId: 1 }])(
        "discards invalid references before any claim or effect: %p",
        async (payload) => {
            const { processor, inbox, progress, job, state, delivery } = await build()
            await processor.process({ ...job, payload })
            expect(progress.advance).not.toHaveBeenCalled()
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
            expect(await jobSnapshot(world.db.primary, delivery.id)).toMatchObject({
                current_step: null,
                fencing_token: "3",
            })
            expect((await state()).receipts[0]?.processed_at).toBeNull()
        },
    )
}

const registerFencing = (world: LiteWorld, build: BuildDelivery): void => {
    it("stops a stale claim before the domain effect", async () => {
        const { processor, inbox, claims, progress, job, claim, state } = await build()
        await claims.fail({ jobId: job.jobId, expectedFencingToken: job.fencingToken, reason: "superseded worker" })
        expect((await claim()).fencingToken).toBe(4)
        const processing = processor.process(job)
        await expect(processing).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        const advanced = progress.advance.mock.results[0]
        assert(advanced?.type === "return")
        const failure = await advanced.value.catch((cause: unknown) => cause)
        await expect(processing).rejects.toBe(failure)
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
        expect((await state()).receipts[0]?.processed_at).toBeNull()
    })

    it("propagates consumer failure for a retry of the pending receipt", async () => {
        const { processor, claims, job, claim, state } = await build()
        const failure = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        refuseNextDeliveryTransaction(world, failure)
        await expect(processor.process(job)).rejects.toBe(failure)
        expect((await state()).receipts[0]?.processed_at).toBeNull()
        await claims.fail({ jobId: job.jobId, expectedFencingToken: job.fencingToken, reason: failure.message })
        const retry = await claim()
        expect(retry.fencingToken).toBe(4)
        await processor.process(retry)
        expect((await state()).receipts[0]?.processed_at).toBeInstanceOf(Date)
    })
}

const registerRegistration = (world: LiteWorld, build: BuildDelivery, registered: ResolveDelivery): void => {
    it("registers its processor with the composed job runner", async () => {
        const { processor, claims, job, delivery, state } = await build()
        const registration = registered()
        expect(processor.constructor.name).toBe("SepayDeliveryProcessor")
        expect(registration.registered).toEqual([processor])
        expect(registration.registered.map((entry) => entry.queue)).toEqual([SEPAY_DELIVERY_QUEUE])
        await claims.fail({ jobId: job.jobId, expectedFencingToken: job.fencingToken, reason: "queue redelivery" })
        await registration.handler.handle(delivery)
        expect(await jobSnapshot(world.db.primary, delivery.id)).toMatchObject({
            status: "done",
            current_step: "sepay-delivery",
            fencing_token: "4",
        })
        expect((await state()).receipts[0]?.processed_at).toBeInstanceOf(Date)
    })
}

describe("SepayDeliveryProcessor (persisted integration)", () => {
    const capability = deliveryCapabilities()
    const world = useTestWorld({ modules: [...capability.modules, SepayDeliveryQueueModule.register({})] })
    beforeAll(() => persistDeliveryWorkspace(world, capability.workspaceId))
    const registrations: Array<RegisteredDelivery> = []
    beforeAll(() => {
        registrations.push(registerDeliveryProcessor(world, world.resolve(SepayDeliveryQueueModule)))
    })
    const registered = (): RegisteredDelivery => {
        const registration = registrations[0]
        assert(registration !== undefined)
        return registration
    }
    beforeEach(() => jest.restoreAllMocks())
    afterEach(() => jest.restoreAllMocks())
    const build = () => deliveryJobBuilder(world, "sepay", capability.workspaceId, registered().processor)
    registerValidation(world, build)
    registerFencing(world, build)
    registerRegistration(world, build, registered)
})
