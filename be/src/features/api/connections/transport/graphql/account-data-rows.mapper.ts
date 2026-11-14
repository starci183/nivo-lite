import type { AccountDataRowsAnswer, AccountDataTypeView } from "@modules/domain/account-data"
import type { AccountDataRowsQueryRequest, AccountDataTypesRequest } from "../../application/account-data-rows.contracts"
import type { AccountDataRowsInput, AccountDataTypesInput } from "./dto/account-data-rows.input"
import type { AccountDataRowsType, AccountDataTypeType } from "./dto/account-data-rows.type"

/** Maps the GraphQL arguments of accountDataTypes to the request. */
export const toAccountDataTypesRequest = (workspaceId: string, input: AccountDataTypesInput): AccountDataTypesRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of accountDataTypes to the GraphQL type. */
export const toAccountDataTypesType = (types: ReadonlyArray<AccountDataTypeView>): Array<AccountDataTypeType> =>
    types.map((type) => ({ ...type, fields: [...type.fields] }))

/** Maps the GraphQL arguments of accountDataRows to the request. */
export const toAccountDataRowsRequest = (workspaceId: string, input: AccountDataRowsInput): AccountDataRowsQueryRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    type: input.type,
    limit: input.limit,
})

/** Maps the answer of accountDataRows to the GraphQL type. */
export const toAccountDataRowsType = (answer: AccountDataRowsAnswer): AccountDataRowsType => ({
    refusal: answer.refusal,
    rows: answer.rows.map((row) => ({ ...row, value: { ...row.value } })),
})
