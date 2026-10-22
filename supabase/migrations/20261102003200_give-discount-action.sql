-- The discount a sales agent gives a customer, counted in percent of the price (v0.3.2 "Văn phòng số": AI Sales asks the Sales
-- managers before a discount above its auto band). The registry row lets a workspace set a rule and member grants for it.
INSERT INTO public.authority_actions (action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode, label) VALUES
    ('give_discount', 'sales', 5, 'ask', NULL, '{customer}', true, NULL, '{"en": "Give discount", "vi": "Giảm giá"}')
ON CONFLICT DO NOTHING;
