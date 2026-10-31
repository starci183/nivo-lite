import dns from "node:dns/promises"
import type { LookupAddress, LookupAllOptions } from "node:dns"

/** The one function of `node:dns/promises` the specs replace, typed as the code under test calls it. */
interface LookupOwner {
    lookup: (hostname: string, options: LookupAllOptions) => Promise<Array<LookupAddress>>
}

const lookupOwner: LookupOwner = dns

/** Makes every name resolve to these addresses (none: to nothing) until the mocks are restored. */
export const resolvingTo = (...addresses: ReadonlyArray<string>) =>
    jest
        .spyOn(lookupOwner, "lookup")
        .mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })))

/** Makes every lookup fail, as an unknown name does. */
export const failingLookup = () => jest.spyOn(lookupOwner, "lookup").mockRejectedValue(new TypeError("ENOTFOUND"))
