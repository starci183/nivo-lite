-- drop-sales-product-records: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by anyone in the CRM-S2 lane: the lane's restart applies it.
-- Owner decision 2026-11-13 (CRM provider via OpenAPI): products are NOT records (records are an agent's process data over time). The record type
-- `blocks-core.sales.product` leaves; the shop's prices are numeric truths of the truth graph, and an order line snapshots its price AND its source
-- (`priceSource: { kind: "fact" | "crm", id }`, instead of `productId`). Contract step: the partition holds only dev seed rows (no product record
-- is kept by a shop, and the order lines that carried a `productId` keep reading: the line shape ignores the old key).
-- The type declares no ref and no contact field, so only a link row could point at it; those leave first (record_links keeps RESTRICT foreign keys).
-- Photos a product kept in the `records` storage bucket are not removed here (SQL does not own the objects): dev seed rows have none.
DELETE FROM public.record_links WHERE from_entity = 'blocks-core.sales.product' OR to_entity = 'blocks-core.sales.product';
ALTER TABLE public.records DETACH PARTITION public.records_blocks_core_sales_product;
DROP TABLE public.records_blocks_core_sales_product;
