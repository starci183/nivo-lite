import type { RecordInstallation } from "@modules/domain/module-installations"
import type { InstanceOfRecordRequest } from "../../application/instance-of-record.contracts"
import type { InstanceOfRecordInput } from "./dto/instance-of-record.input"

/** Maps the GraphQL arguments of instanceOfRecord to the request. */
export const toInstanceOfRecordRequest = (
    workspaceId: string,
    input: InstanceOfRecordInput,
): InstanceOfRecordRequest => ({
    workspaceId,
    recordId: input.recordId,
})

/** Maps the owning installation to the GraphQL id. */
export const toInstanceOfRecordId = (result: RecordInstallation): string | null => result.installationId
