import type { Claim } from "./reconcile.types"

/** The claims that still wait for an arrival. */
export const openClaims = (claims: ReadonlyArray<Claim>): ReadonlyArray<Claim> =>
    claims.filter((claim) => claim.status === "open")

/** The open claims of one party, oldest first. */
export const openClaimsOf = (claims: ReadonlyArray<Claim>, partyKey: string): ReadonlyArray<Claim> =>
    openClaims(claims)
        .filter((claim) => claim.partyKey === partyKey)
        .toSorted((left, right) => left.at - right.at)

/** The open claims that have waited `timeoutMs` or longer at `now`: the ones a person has to look at. */
export const overdueClaims = (claims: ReadonlyArray<Claim>, now: number, timeoutMs: number): ReadonlyArray<Claim> =>
    openClaims(claims).filter((claim) => now - claim.at >= timeoutMs)

/** The key a claim is written under, so the same word of the same party at the same moment is one claim. */
export const claimKeyOf = (partyKey: string | null, at: number, text: string): string =>
    `${partyKey ?? "-"}:${at}:${text.trim().toLowerCase()}`

/** The claim after an arrival settled it; a claim that is not open stays as it is. */
export const settleClaim = (claim: Claim): Claim => (claim.status === "open" ? { ...claim, status: "settled" } : claim)

/** The claim after its wait ran out and a person was asked; a claim that is not open stays as it is. */
export const escalateClaim = (claim: Claim): Claim =>
    claim.status === "open" ? { ...claim, status: "escalated" } : claim
