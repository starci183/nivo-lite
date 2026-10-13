import type { ListFreeTimesRequest, ListFreeTimesResult } from "../../application/list-free-times.contracts"
import type { ListFreeTimesParamsRequest, ListFreeTimesSearchRequest } from "./dto/list-free-times.request"
import type { ListFreeTimesResponse } from "./dto/list-free-times.response"

/** Maps the HTTP input of list-free-times to the command request. */
export const toListFreeTimesRequest = (
    params: ListFreeTimesParamsRequest,
    query: ListFreeTimesSearchRequest,
): ListFreeTimesRequest => ({ slug: params.slug, service: query.service, date: query.date, party: query.party })

/** Maps the list-free-times result to the HTTP answer. */
export const toListFreeTimesResponse = (result: ListFreeTimesResult): ListFreeTimesResponse => result
