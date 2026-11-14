import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import type { RecordModuleView } from "@modules/domain/workbench-door"
import { RecordTypesQuery } from "../../application/record-types.query"
import { RecordModuleType } from "./dto/record-types.type"

/** The modules as GraphQL types (the JSON Schemas as JSON text). */
const toRecordModuleTypes = (modules: ReadonlyArray<RecordModuleView>): Array<RecordModuleType> =>
    modules.map((module) => ({
        module: module.module,
        types: module.types.map((type) => ({
            name: type.name,
            fields: type.fields.map((field) => ({ ...field, values: field.values === null ? null : [...field.values] })),
        })),
        reads: module.reads.map((read) => ({
            id: read.id,
            dataKind: read.dataKind,
            shape: read.shape,
            permission: read.permission,
            variablesJson: JSON.stringify(read.variables),
        })),
        actions: module.actions.map((action) => ({
            id: action.id,
            permission: action.permission,
            inputJson: action.input === null ? null : JSON.stringify(action.input),
        })),
    }))

@Resolver()
/** GraphQL door of recordTypes. */
export class RecordTypesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The record types of the workspace's installed agents with the workbench reads and actions that reach them (any member). */
    @Query(() => [RecordModuleType], { name: "recordTypes" })
    async recordTypes(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<RecordModuleType>> {
        return toRecordModuleTypes(await this.queryBus.execute(new RecordTypesQuery({ request: { workspaceId }, principal })))
    }
}
