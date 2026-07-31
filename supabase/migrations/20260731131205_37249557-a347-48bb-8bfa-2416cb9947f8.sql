GRANT SELECT ON public.zones TO anon, authenticated;
GRANT SELECT ON public.merchants TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE ON public.merchants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.zones TO service_role;
GRANT ALL ON public.merchants TO service_role;
GRANT ALL ON public.products TO service_role;

INSERT INTO public.zones (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'GRA Phase 1'),
  ('22222222-2222-2222-2222-222222222222', 'Monday Market')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.merchants (id, business_name, category, status, lat, lng, address_text, commission_pct, opening_time, closing_time, is_open_override) VALUES
  ('a0000001-0000-4000-8000-000000000001','Mama Tolu Kitchen','home_kitchen','approved',11.8311,13.1510,'Off Damboa Road, GRA Phase 1',12,'08:00','21:00',true),
  ('a0000002-0000-4000-8000-000000000002','Pristine H2O Depot','water','approved',11.8402,13.1602,'Baga Road, near Monday Market',8,'06:00','19:00',true),
  ('a0000003-0000-4000-8000-000000000003','Alhaji Modu Prime Beef','meat','approved',11.8425,13.1571,'Monday Market, Line 4',10,'07:00','17:00',false),
  ('a0000004-0000-4000-8000-000000000004','Bulama Gas Refill','gas','approved',11.8288,13.1544,'Shehu Laminu Way, GRA',9,'08:00','20:00',true),
  ('a0000005-0000-4000-8000-000000000005','Aisha Home Bakes','bakery','approved',11.8339,13.1487,'Polo Area, GRA Phase 1',12,'09:00','20:00',true),
  ('a0000006-0000-4000-8000-000000000006','Shehu Mini Supermarket','grocery','approved',11.8371,13.1559,'Post Office Road, Maiduguri',10,'08:00','22:00',true),
  ('a0000007-0000-4000-8000-000000000007','Sabo Care Pharmacy','pharmacy','approved',11.8353,13.1522,'Bank Road, GRA Phase 1',10,'08:00','22:00',true),
  ('a0000008-0000-4000-8000-000000000008','Kanuri Suya Spot','restaurant','approved',11.8318,13.1533,'Lagos Street, GRA',14,'16:00','23:00',true),
  ('a0000009-0000-4000-8000-000000000009','Zainab Cosmetics','cosmetics','approved',11.8430,13.1585,'Monday Market, Cosmetics Line',12,'09:00','18:00',true),
  ('a000000a-0000-4000-8000-00000000000a','Borno Swift Courier','courier','approved',11.8362,13.1548,'Ramat Square, Maiduguri',10,'08:00','20:00',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (merchant_id, name, description, price_kobo, category, is_available, prep_time_mins) VALUES
  ('a0000001-0000-4000-8000-000000000001','Party Jollof Rice + Chicken','Smoky party-style jollof with a quarter chicken and coleslaw',350000,'Main dishes',true,25),
  ('a0000001-0000-4000-8000-000000000001','Miyan Kuka & Tuwo','Baobab leaf soup with beef and tuwo shinkafa',280000,'Main dishes',true,25),
  ('a0000001-0000-4000-8000-000000000001','Masa (6 pieces)','Soft rice cakes served with yaji pepper',120000,'Sides',true,15),
  ('a0000001-0000-4000-8000-000000000001','Zobo (1 litre)','Chilled hibiscus drink, lightly spiced',80000,'Drinks',true,5),
  ('a0000002-0000-4000-8000-000000000002','20L Bottled Water Refill','Treated, sealed 20 litre refill for your dispenser',90000,'Refills',true,10),
  ('a0000002-0000-4000-8000-000000000002','Bag of Sachet Water (20 pcs)','Cold pure water sachets, factory sealed',30000,'Sachet water',true,10),
  ('a0000002-0000-4000-8000-000000000002','75cl Table Water (Carton)','12 bottles per carton',250000,'Bottled',true,10),
  ('a0000003-0000-4000-8000-000000000003','Fresh Beef (1kg)','Cut to order, boneless',420000,'Beef',true,20),
  ('a0000003-0000-4000-8000-000000000003','Mixed Offal (1kg)','Liver, tripe and kidney mix',280000,'Beef',true,20),
  ('a0000003-0000-4000-8000-000000000003','Ram Meat (1kg)','Fresh mutton, cut to order',520000,'Mutton',true,25),
  ('a0000004-0000-4000-8000-000000000004','12.5kg Gas Refill','Bring-nothing refill, cylinder exchange available',1450000,'Refills',true,30),
  ('a0000004-0000-4000-8000-000000000004','6kg Gas Refill','Ideal for small households',720000,'Refills',true,30),
  ('a0000005-0000-4000-8000-000000000005','Sliced Sandwich Bread','Baked this morning, soft and unsweetened',120000,'Bread',true,10),
  ('a0000005-0000-4000-8000-000000000005','Meat Pie (4 pieces)','Hand-made, generous filling',160000,'Snacks',true,15),
  ('a0000005-0000-4000-8000-000000000005','Birthday Cake (6 inch)','Vanilla sponge, simple icing. Order a day ahead',850000,'Cakes',true,60),
  ('a0000006-0000-4000-8000-000000000006','Golden Penny Semovita 1kg','Household staple',150000,'Staples',true,10),
  ('a0000006-0000-4000-8000-000000000006','Rice (Mudu)','Local long grain, one mudu measure',180000,'Staples',true,10),
  ('a0000006-0000-4000-8000-000000000006','Groundnut Oil (1 litre)','Locally pressed',220000,'Cooking',true,10),
  ('a0000006-0000-4000-8000-000000000006','Peak Milk Sachet (Pack of 10)','Powdered milk sachets',280000,'Provisions',true,10),
  ('a0000007-0000-4000-8000-000000000007','Paracetamol 500mg (Card)','Pain and fever relief',15000,'Over the counter',true,10),
  ('a0000007-0000-4000-8000-000000000007','Coartem Antimalarial','Full adult treatment course',280000,'Over the counter',true,10),
  ('a0000007-0000-4000-8000-000000000007','Baby Diapers (Medium, 30s)','Overnight dryness',450000,'Baby care',true,10),
  ('a0000008-0000-4000-8000-000000000008','Beef Suya (Full Wrap)','Charcoal grilled, heavy on the yaji',250000,'Grill',true,20),
  ('a0000008-0000-4000-8000-000000000008','Kilishi (100g)','Dried spiced beef, Maiduguri style',350000,'Grill',true,10),
  ('a0000008-0000-4000-8000-000000000008','Grilled Chicken & Potato','Half chicken with fried potatoes',480000,'Grill',true,30),
  ('a0000009-0000-4000-8000-000000000009','Shea Butter (500g)','Unrefined, locally sourced',150000,'Skin',true,10),
  ('a0000009-0000-4000-8000-000000000009','Turaren Wuta Incense Set','Traditional home fragrance blend',300000,'Fragrance',true,10),
  ('a000000a-0000-4000-8000-00000000000a','Same-Day Parcel (Within Zone)','Document or small parcel, picked up and delivered today',150000,'Courier',true,15),
  ('a000000a-0000-4000-8000-00000000000a','Bulk Parcel (Up to 10kg)','Larger parcel within Maiduguri',300000,'Courier',true,20);