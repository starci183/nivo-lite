import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type { WorkPerformer } from "@modules/domain/decisions"
import type { AfterCommit } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { itemOf } from "./work-engine.builder"

/** Arranges an open decision and a deferred notification port without claiming database commit behavior. */
export const timeoutFixture = (afterCommit: MockOf<AfterCommit>) => {
    const manager = mockEntityManager()
    const item = itemOf({ status: "waiting_decision" })
    const rejected = itemOf({ status: "rejected", result: { summary: "Rejected by timeout" } })
    const rejection = mock<Required<Pick<WorkPerformer, "onReject">>>()
    rejection.onReject.mockResolvedValue(undefined)
    const performer = mock<WorkPerformer>({ onReject: rejection.onReject })
    const barePerformer = builder<WorkPerformer>({ prepare: performer.prepare, perform: performer.perform })()
    const pending: Array<Parameters<AfterCommit["run"]>[1]> = []
    afterCommit.run.mockImplementation((_manager, task) => {
        pending.push(task)
        return Promise.resolve()
    })
    const deliver = () => eachInOrder(pending.splice(0), (task) => task())
    return { manager, item, rejected, performer, barePerformer, rejection, afterCommit, pending, deliver }
}
