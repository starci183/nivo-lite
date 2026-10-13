import { ConfigError, ConfigErrorCode } from "./errors/config.error"
import { EnvSource, Secret } from "./env-source.config"

const invalid = (key: string): ConfigError => new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key } })
const missing = (key: string): ConfigError => new ConfigError({ code: ConfigErrorCode.KeyMissing, params: { key } })

describe("Secret", () => {
    it("reveals the value to the caller and masks it when serialized", () => {
        const secret = new Secret("token-1")

        expect(secret.reveal()).toBe("token-1")
        expect(secret.toJSON()).toBe("[secret]")
        expect(JSON.stringify({ secret })).toBe('{"secret":"[secret]"}')
    })
})

describe("EnvSource", () => {
    describe("has, optional and anyDeclared", () => {
        const env = new EnvSource({ PRESENT: "yes", EMPTY: "", ZERO: "0" })

        it("treats a missing or empty value as absent and keeps a declared one", () => {
            expect(env.has("PRESENT")).toBe(true)
            expect(env.has("ZERO")).toBe(true)
            expect(env.has("EMPTY")).toBe(false)
            expect(env.has("GONE")).toBe(false)
            expect(env.optional("PRESENT")).toBe("yes")
            expect(env.optional("ZERO")).toBe("0")
            expect(env.optional("EMPTY")).toBeUndefined()
            expect(env.optional("GONE")).toBeUndefined()
        })

        it("is true when any listed key is declared", () => {
            expect(env.anyDeclared(["GONE", "PRESENT"])).toBe(true)
            expect(env.anyDeclared(["GONE", "EMPTY"])).toBe(false)
            expect(env.anyDeclared([])).toBe(false)
        })
    })

    describe("string, int and bool", () => {
        it("reads a required string and names a missing key", () => {
            expect(new EnvSource({ NAME: "nivo" }).string("NAME")).toBe("nivo")
            expect(() => new EnvSource({}).string("NAME")).toThrow(missing("NAME"))
            expect(() => new EnvSource({ NAME: "" }).string("NAME")).toThrow(missing("NAME"))
        })

        it("reads an integer, uses a fallback only when the key is absent, and refuses a fraction", () => {
            const declared = new EnvSource({ COUNT: "12", FRACTION: "1.5", WORD: "many" })

            expect(declared.int("COUNT")).toBe(12)
            expect(declared.int("COUNT", 3)).toBe(12)
            expect(new EnvSource({}).int("COUNT", 0)).toBe(0)
            expect(new EnvSource({ COUNT: "" }).int("COUNT", 4)).toBe(4)
            expect(() => declared.int("FRACTION")).toThrow(invalid("FRACTION"))
            expect(() => declared.int("WORD")).toThrow(invalid("WORD"))
            expect(() => new EnvSource({}).int("COUNT")).toThrow(missing("COUNT"))
        })

        it("reads true or false and refuses any other word", () => {
            expect(new EnvSource({ ON: "true" }).bool("ON")).toBe(true)
            expect(new EnvSource({ ON: "false" }).bool("ON", true)).toBe(false)
            expect(new EnvSource({}).bool("ON", false)).toBe(false)
            expect(() => new EnvSource({ ON: "yes" }).bool("ON")).toThrow(invalid("ON"))
            expect(() => new EnvSource({}).bool("ON")).toThrow(missing("ON"))
        })
    })

    describe("url, enum, duration and secret", () => {
        const modes = ["live", "test"]

        it("requires an absolute URL and one of the allowed words", () => {
            const env = new EnvSource({ SITE: "https://nivo.vn/app", MODE: "live", MODE_BAD: "other" })

            expect(env.url("SITE")).toBe("https://nivo.vn/app")
            expect(env.enum("MODE", modes)).toBe("live")
            expect(() => env.url("SITE_BAD")).toThrow(missing("SITE_BAD"))
            expect(() => new EnvSource({ SITE: "nivo.vn" }).url("SITE")).toThrow(invalid("SITE"))
            expect(() => env.enum("MODE_BAD", modes)).toThrow(invalid("MODE_BAD"))
        })

        it("reads a duration in milliseconds and uses the fallback only when the key is absent", () => {
            expect(new EnvSource({ WAIT: "250" }).duration("WAIT")).toBe(250)
            expect(new EnvSource({ WAIT: "250ms" }).duration("WAIT")).toBe(250)
            expect(new EnvSource({ WAIT: "30s" }).duration("WAIT")).toBe(30_000)
            expect(new EnvSource({ WAIT: "5m" }).duration("WAIT")).toBe(300_000)
            expect(new EnvSource({ WAIT: "2h" }).duration("WAIT")).toBe(7_200_000)
            expect(new EnvSource({}).duration("WAIT", 500)).toBe(500)
            expect(() => new EnvSource({ WAIT: "2d" }).duration("WAIT")).toThrow(invalid("WAIT"))
            expect(() => new EnvSource({ WAIT: "soon" }).duration("WAIT")).toThrow(invalid("WAIT"))
            expect(() => new EnvSource({}).duration("WAIT")).toThrow(missing("WAIT"))
        })

        it("wraps a required value as a secret", () => {
            expect(new EnvSource({ TOKEN: "secret-1" }).secret("TOKEN")).toEqual(new Secret("secret-1"))
            expect(() => new EnvSource({}).secret("TOKEN")).toThrow(missing("TOKEN"))
        })
    })
})
