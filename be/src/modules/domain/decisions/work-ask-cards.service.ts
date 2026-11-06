import { Injectable } from "@nestjs/common"
import type { WorkAskCards } from "./work-lines.contracts"

@Injectable()
/**
 * The approval cards of an app that posts none: no decision has a card, so every ask is said as its own line. The team chat replaces it
 * with the rooms its approval hook posted a decision to (the one line in `DecisionsModule` that binds `WORK_ASK_CARDS`).
 */
export class NoAskCardsService implements WorkAskCards {
    /** No card is posted anywhere. */
    cardsOf(): Promise<number> {
        return Promise.resolve(0)
    }
}
