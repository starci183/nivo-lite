import { Test } from "@nestjs/testing"
import type { AccountDataTypeDef } from "@modules/domain/account-data"
import { ACCOUNT_DATA_CATALOG } from "./account-data-catalog"
import { ACCOUNT_STREAM_EXEMPTIONS, ACCOUNT_STREAMS, streamGapsOf } from "./account-streams.policy"

const SUBJECT = Symbol("account-streams.policy")

const build = async (): Promise<Pick<typeof import("./account-streams.policy"), "streamGapsOf">> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { streamGapsOf } }],
    }).compile()
    return moduleRef.get<Pick<typeof import("./account-streams.policy"), "streamGapsOf">>(SUBJECT)
}

const waking = (provider: string): AccountDataTypeDef => ({
    name: `${provider}.event`,
    provider,
    version: 1,
    write: "append",
    fields: { id: { type: "text", required: true } },
    key: ["id"],
    wakes: true,
    retention: { days: 30 },
})

describe("ACCOUNT_STREAMS", () => {
    let policy: Pick<typeof import("./account-streams.policy"), "streamGapsOf">

    beforeAll(async () => {
        policy = await build()
    })

    it("gives every provider of the catalog that owns a wakes type a stream identity or an exemption with a reason", () => {
        expect(policy.streamGapsOf(ACCOUNT_DATA_CATALOG, ACCOUNT_STREAMS, ACCOUNT_STREAM_EXEMPTIONS)).toEqual([])
    })

    it("names a waking provider without identity, a provider declared twice and an identity without a key", () => {
        const telegram = { provider: "telegram", streamIdentity: { metaKeys: ["bot_id"] } }

        expect(
            policy.streamGapsOf(
                [waking("telegram"), waking("zalo_oa"), waking("casso")],
                [telegram, { provider: "casso", streamIdentity: { metaKeys: [] } }],
                [
                    { provider: "telegram", reason: "x" },
                    { provider: "zalo_oa", reason: "" },
                ],
            ),
        ).toEqual(["zalo_oa: wakes with no stream identity", "telegram: declared twice", "casso: no key"])
    })
})
