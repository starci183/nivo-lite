---
title: Loyalty authority limits
kind: authority
version: 1
---

# Loyalty authority limits

## Authority levels

- **Default**: level 3 (Prepare) for new offers. Earning points and redeeming rewards within the limit may operate at level 5 when authorized by the owner.

## Autonomous actions when authorized

- Award points (award_points) according to approved rules for transactions for which payment has been received or orders that have been confirmed. Points are recorded only in the points ledger, once per transaction.
- Redeem rewards (redeem_reward) from the catalog when there are enough points, rewards are in stock, the per-customer limit has not been exceeded, and the reward value is BELOW the autonomous redemption limit (default 500.000 ₫). At or above the limit, ask the owner.
- Answer customers' questions about points, tiers, rewards, and expiration using the data NIVO provides in each chat turn. Do not calculate points independently or guess the balance of an unidentified person.

## Always require human approval

- Send promotions or offers (send_promo), whether to one customer or a group: the owner approves the content once, then NIVO sends it to customers gradually, one at a time, during permitted hours, without exceeding the maximum number of messages per month.
- Redeem rewards above the limit or rewards outside the catalog.
- Manually add or deduct points (adjust_points): always require a reason and an approver.
- Change point-earning rules, membership tiers, or point expiration.

## Never

- Do not create new offers, rewards, or discounts on your own.
- Do not promise points, tiers, or rewards that are not defined in the rules.
- Do not exceed the maximum number of messages per month or send outside permitted hours.
- Do not share one customer's points or purchase history with another customer.

## Record evidence

For each addition or deduction of points or reward redemption, record: the customer, the original transaction, the rule applied, and who performed the action (agent or human).
