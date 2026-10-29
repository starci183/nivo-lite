import { mockEntityManager } from "@starci/jest-preset"
import { answerByTable } from "./table-query-builder.builder"
import type { TableAnswers } from "./table-query-builder.builder"

/** The table each read of the capability asks, so a spec names the read it answers. */
export const FIND_CHATBOT_CONVERSATION = "public.agent_conversations"
export const LIST_CHATBOT_CONVERSATIONS = "public.agent_conversations"
export const LIST_CHATBOT_MESSAGE_BRIEFS = "public.agent_messages"
export const LIST_CHATBOT_MESSAGES = "public.agent_messages"
export const LIST_CHATBOT_WAITING = "public.work_items"
export const LIST_CHATBOT_INSTALLATIONS = "public.module_installations"
export const LIST_CHATBOT_AGENTS = "public.agents"

type TableStub = readonly [string, ReadonlyArray<unknown>]

const SEEN = new WeakMap<object, TableAnswers>()

const isPair = (value: TableStub | ReadonlyArray<TableStub>): value is TableStub => typeof value[0] === "string"

/** A manager whose tables answer the given rows; `query` names them as a pair or a list of pairs. */
export const tablesEm = (stubs: { readonly query?: TableStub | ReadonlyArray<TableStub> } = {}) => {
    const em = mockEntityManager()
    const given = stubs.query ?? []
    const pairs: ReadonlyArray<TableStub> = isPair(given) ? [given] : given
    const rowsOf = (table: string): ReadonlyArray<unknown> => pairs.find(([name]) => name === table)?.[1] ?? []
    OWNED.set(em, { waiting: rowsOf(LIST_CHATBOT_WAITING), installations: rowsOf(LIST_CHATBOT_INSTALLATIONS) })
    SEEN.set(
        em,
        answerByTable(
            em,
            Object.fromEntries(
                pairs.filter(([name]) => name !== LIST_CHATBOT_WAITING && name !== LIST_CHATBOT_INSTALLATIONS),
            ),
        ),
    )
    return { em }
}

/** The rows the owners of the work items and the installations answer for one manager. */
const OWNED = new WeakMap<object, { waiting: ReadonlyArray<unknown>; installations: ReadonlyArray<unknown> }>()

/** The named parameters of every condition the subject put on its n-th read of a table. */
export const parametersOf = (em: object, table: string, nth = 0): unknown =>
    Object.assign(
        {},
        ...(SEEN.get(em)?.queriesOf(table)[nth]?.calls ?? [])
            .filter((call) => call.method === "where" || call.method === "andWhere")
            .map((call) => call.args[1]),
    )

/** The answers recorded for the tables of one manager from {@link tablesEm}. */
export const seenOf = (em: object): TableAnswers | undefined => SEEN.get(em)

/** The rows the owners of the work items and the installations answer for one manager from {@link tablesEm}. */
export const ownedOf = (em: object) => OWNED.get(em)
