import type { EnterpriseSeed, EnterpriseSeedPlace, EnterpriseSeedTarget } from "./enterprise-seed.contracts"
import { enterpriseSeedDocument } from "./enterprise-seed.schema"
import { invalid, readSeedDocuments } from "./management-seed.policy"

/** The stack environments the seed knows, by the name `application-stacks.yaml` declares, and the place each one is. */
const PLACES: Readonly<Record<string, EnterpriseSeedPlace>> = { dev: "local", production: "prod" }

/** The place an environment is: `dev` the local stack, `production` prod; any other name is refused. */
export const placeOf = (environment: string): EnterpriseSeedPlace => PLACES[environment] ?? invalid("env")

/** Whether a target seeds the place: `both` each, `off` neither, `local` and `prod` their own one. */
export const targetIncludes = (target: EnterpriseSeedTarget, place: EnterpriseSeedPlace): boolean =>
    target === "both" || target === place

/** One enterprise document checked; a malformed one is refused by the name of its first wrong field, never its content. */
const readEnterpriseSeed = (document: unknown): EnterpriseSeed => {
    const parsed = enterpriseSeedDocument.safeParse(document)
    if (parsed.success) {
        const { identifier, target, workspaceName, ownerWorkspace } = parsed.data
        return { identifier, target, workspaceName, ownerWorkspace }
    }
    const key = parsed.error.issues[0]?.path[0]
    return invalid(typeof key === "string" ? key : "document")
}

const isDocument = (value: unknown): boolean => value !== null && typeof value === "object" && "schema" in value

/** The documents `text` holds: the stack seed envelope, or one bare document (a tracked file piped in by hand). */
const documentsOf = (text: string): ReadonlyArray<unknown> => {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch (cause) {
        return invalid("input", cause)
    }
    return isDocument(parsed) ? [parsed] : readSeedDocuments(text)
}

/** The enterprises `text` declares, one per document; two documents of one identifier are refused. */
export const readEnterpriseSeeds = (text: string): ReadonlyArray<EnterpriseSeed> => {
    const seeds = documentsOf(text).map((document) => readEnterpriseSeed(document))
    const identifiers = seeds.map((seed) => seed.identifier)
    return new Set(identifiers).size === identifiers.length ? seeds : invalid("identifier")
}
