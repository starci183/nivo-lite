import { EnvSource, Secret } from "@modules/platform/config"
import { parseSepaySimulationConfig } from "./sepay-simulation.config"

describe("parseSepaySimulationConfig", () => {
    it("leaves the key absent and defaults the bank account and webhook url", () => {
        const post = jest.fn()
        const print = jest.fn()

        expect(parseSepaySimulationConfig(new EnvSource({}), post, print)).toEqual({
            apiKey: undefined,
            bankCode: "MBBank",
            bankAccount: "0000000000",
            url: "http://localhost:3000/api/sepay/webhook",
            post,
            print,
        })
        expect(post).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("reads the configured secret, bank account and webhook url", () => {
        const post = jest.fn()
        const print = jest.fn()
        const env = new EnvSource({
            SEPAY_WEBHOOK_API_KEY: "sepay-key",
            SEPAY_BANK_CODE: "Vietcombank",
            SEPAY_BANK_ACCOUNT: "1234567890",
            SEPAY_SIMULATE_URL: "http://localhost:4000/api/sepay/webhook",
        })

        expect(parseSepaySimulationConfig(env, post, print)).toEqual({
            apiKey: new Secret("sepay-key"),
            bankCode: "Vietcombank",
            bankAccount: "1234567890",
            url: "http://localhost:4000/api/sepay/webhook",
            post,
            print,
        })
        expect(post).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })
})
