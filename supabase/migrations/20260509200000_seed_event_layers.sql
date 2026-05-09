-- Seed `public.event_layers` with World Cup (BMO Field / Exhibition Place)
-- and Disaster (downtown Toronto envelope + blocked roads) demo geography.
--
-- These rows mirror `lib/mock/worldCupLayers.ts` and the disaster seeds in
-- `lib/tools/_mockGeo.ts` / `lib/mock/simulate-seed-geometry.ts` so that
-- backend tools (`event_zone_lookup`, future `nearest_help_point_lookup`)
-- and `repositorySimulateWorldCup` can return real DB rows instead of an
-- empty array (`docs/api_contracts.md` §4.10, project_plan.md §13.1 / §13.3).
--
-- Run after the Section-12 schema migration. Idempotent on re-run via
-- `on conflict do update` against the `event_layers.id` primary key.
--
-- GeoJSON convention: positions are [lng, lat]. Polygon rings close on
-- themselves and are wound counter-clockwise. Use the @> jsonb operator
-- if you need to filter on metadata.

-- Allow anon SELECT so the dashboard's `EventLayer` overlay can read the
-- shared layers via the browser client (writes still require service role).
-- `IF NOT EXISTS` on `create policy` is PostgreSQL 16+; emulate with a
-- pg_policies guard so this migration is safe on PG 15 (Supabase default).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_layers'
      and policyname = 'event_layers_select_anon'
  ) then
    create policy "event_layers_select_anon"
      on public.event_layers
      for select
      to anon
      using (true);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- World Cup layers (mode = 'world_cup') — anchored on BMO Field / Exhibition Place.
-- ---------------------------------------------------------------------------

insert into public.event_layers (id, mode, layer_type, name, geometry, metadata)
values
  (
    'world-cup-stadium-perimeter-bmo-field',
    'world_cup',
    'stadium_perimeter',
    'BMO Field perimeter (mock)',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.42025, 43.63325),
        jsonb_build_array(-79.41765, 43.63255),
        jsonb_build_array(-79.41585, 43.63355),
        jsonb_build_array(-79.41665, 43.6351),
        jsonb_build_array(-79.41915, 43.63535),
        jsonb_build_array(-79.42045, 43.63435),
        jsonb_build_array(-79.42025, 43.63325)
      ))
    ),
    jsonb_build_object('capacity', 30000, 'note', 'Demo stadium footprint for surge layer visuals.')
  ),
  (
    'world-cup-fan-zone-exhibition-west',
    'world_cup',
    'fan_zone',
    'Fan zone: Exhibition West',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.4243, 43.6324),
        jsonb_build_array(-79.4212, 43.6316),
        jsonb_build_array(-79.4194, 43.6327),
        jsonb_build_array(-79.421, 43.6341),
        jsonb_build_array(-79.4239, 43.6342),
        jsonb_build_array(-79.4243, 43.6324)
      ))
    ),
    jsonb_build_object(
      'crowd_target', 'high',
      'amenities', jsonb_build_array('screens', 'water', 'first_aid')
    )
  ),
  (
    'world-cup-fan-zone-exhibition-east',
    'world_cup',
    'fan_zone',
    'Fan zone: Exhibition East',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.417, 43.6316),
        jsonb_build_array(-79.4142, 43.6317),
        jsonb_build_array(-79.4136, 43.6332),
        jsonb_build_array(-79.4151, 43.6343),
        jsonb_build_array(-79.4172, 43.6341),
        jsonb_build_array(-79.418, 43.6327),
        jsonb_build_array(-79.417, 43.6316)
      ))
    ),
    jsonb_build_object(
      'crowd_target', 'medium',
      'amenities', jsonb_build_array('screens', 'info')
    )
  ),
  (
    'world-cup-restricted-vehicle-princes',
    'world_cup',
    'restricted_vehicle_zone',
    'Restricted vehicle zone: Princes'' Blvd (mock)',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.4232, 43.63105),
        jsonb_build_array(-79.4144, 43.63115),
        jsonb_build_array(-79.4139, 43.63245),
        jsonb_build_array(-79.4226, 43.63255),
        jsonb_build_array(-79.4232, 43.63105)
      ))
    ),
    jsonb_build_object(
      'enforcement', 'strict',
      'allowed', jsonb_build_array('emergency', 'transit', 'credentialed')
    )
  ),
  (
    'world-cup-crowd-density-south-plaza',
    'world_cup',
    'crowd_density_zone',
    'High-density crowd: South plaza',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.4216, 43.63265),
        jsonb_build_array(-79.4187, 43.63195),
        jsonb_build_array(-79.4172, 43.6331),
        jsonb_build_array(-79.4186, 43.63405),
        jsonb_build_array(-79.4209, 43.634),
        jsonb_build_array(-79.4216, 43.63265)
      ))
    ),
    jsonb_build_object('density', 'high', 'risk', 'heat')
  ),
  (
    'world-cup-crowd-density-north-gates',
    'world_cup',
    'crowd_density_zone',
    'High-density crowd: North gates',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.4201, 43.6353),
        jsonb_build_array(-79.4176, 43.63505),
        jsonb_build_array(-79.4169, 43.6361),
        jsonb_build_array(-79.4182, 43.63685),
        jsonb_build_array(-79.4201, 43.63655),
        jsonb_build_array(-79.4206, 43.63575),
        jsonb_build_array(-79.4201, 43.6353)
      ))
    ),
    jsonb_build_object('density', 'very_high', 'risk', 'crush')
  ),
  (
    'world-cup-medical-tent-1',
    'world_cup',
    'medical_tent',
    'Medical tent: Gate A',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.41855, 43.63435)
    ),
    jsonb_build_object('staffed', true, 'supplies', 'advanced')
  ),
  (
    'world-cup-medical-tent-2',
    'world_cup',
    'medical_tent',
    'Medical tent: Fan zone west',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.42245, 43.63335)
    ),
    jsonb_build_object('staffed', true, 'supplies', 'basic')
  ),
  (
    'world-cup-police-post-1',
    'world_cup',
    'police_tent',
    'Police post: Princes'' Blvd checkpoint',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.4187, 43.63175)
    ),
    jsonb_build_object('unit', 'TPS', 'radios', true)
  ),
  (
    'world-cup-security-post-1',
    'world_cup',
    'security_tent',
    'Security post: North entrance',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.41895, 43.63605)
    ),
    jsonb_build_object('vendor', 'event_security', 'screening', 'bag_check')
  ),
  (
    'world-cup-lost-and-found-1',
    'world_cup',
    'lost_and_found',
    'Lost & found: Info kiosk',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.41615, 43.63375)
    ),
    jsonb_build_object('languages', jsonb_build_array('en', 'fr', 'es'))
  ),
  (
    'world-cup-tourist-help-1',
    'world_cup',
    'tourist_help',
    'Tourist help: Transit hub desk',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.41395, 43.63225)
    ),
    jsonb_build_object(
      'languages', jsonb_build_array('en', 'fr', 'pt', 'es'),
      'services', jsonb_build_array('directions', 'safety', 'accessibility')
    )
  ),
  (
    'world-cup-transit-node-exhibition',
    'world_cup',
    'transit_node',
    'Transit node: Exhibition GO / TTC',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.41555, 43.63585)
    ),
    jsonb_build_object('type', 'rail_streetcar', 'congestion', 'high')
  ),
  (
    'world-cup-transit-node-lakeshore',
    'world_cup',
    'transit_node',
    'Transit node: Lakeshore access',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-79.42355, 43.63125)
    ),
    jsonb_build_object('type', 'bus_shuttle', 'congestion', 'medium')
  ),
  (
    'world-cup-road-closure-princes-blvd',
    'world_cup',
    'road_closure',
    'Road closure: Princes'' Blvd',
    jsonb_build_object(
      'type', 'LineString',
      'coordinates', jsonb_build_array(
        jsonb_build_array(-79.4233, 43.6317),
        jsonb_build_array(-79.4204, 43.63175),
        jsonb_build_array(-79.4176, 43.63185),
        jsonb_build_array(-79.4149, 43.63195)
      )
    ),
    jsonb_build_object(
      'reason', 'stadium security perimeter',
      'status', 'closed',
      'enforced_until', '23:30'
    )
  ),
  (
    'world-cup-road-closure-lakeshore-ramp',
    'world_cup',
    'road_closure',
    'Road closure: Lakeshore ramp staging',
    jsonb_build_object(
      'type', 'LineString',
      'coordinates', jsonb_build_array(
        jsonb_build_array(-79.4262, 43.63215),
        jsonb_build_array(-79.42425, 43.63175),
        jsonb_build_array(-79.4222, 43.63125)
      )
    ),
    jsonb_build_object(
      'reason', 'shuttle staging',
      'status', 'restricted',
      'enforced_until', '22:45'
    )
  )
on conflict (id) do update set
  mode = excluded.mode,
  layer_type = excluded.layer_type,
  name = excluded.name,
  geometry = excluded.geometry,
  metadata = excluded.metadata;

-- ---------------------------------------------------------------------------
-- Disaster layers (mode = 'disaster').
--
-- The two impact-zone polygons cover the union of all 29 disaster simulate
-- seed coordinates after jitter (see DISASTER_SIM_SEED_GEO_SLOTS in
-- `lib/mock/simulate-seed-geometry.ts`). Padded ±0.006° on each side so
-- pins always render inside the polygon.
-- ---------------------------------------------------------------------------

insert into public.event_layers (id, mode, layer_type, name, geometry, metadata)
values
  (
    'ds-impact-sim-critical',
    'disaster',
    'impact_zone',
    'Disaster impact zone — critical cohort (downtown / Bloor–Spadina / High Park West)',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.4517, 43.6292),
        jsonb_build_array(-79.3672, 43.6292),
        jsonb_build_array(-79.3672, 43.6892),
        jsonb_build_array(-79.4517, 43.6892),
        jsonb_build_array(-79.4517, 43.6292)
      ))
    ),
    jsonb_build_object(
      'severity', 'high',
      'summary', 'Bounds all `/api/simulate/disaster` critical-seed coordinates after jitter.'
    )
  ),
  (
    'ds-impact-sim-urgent',
    'disaster',
    'impact_zone',
    'Disaster impact zone — urgent cohort (Financial District / Yonge corridor / Scarborough)',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.4162, 43.6252),
        jsonb_build_array(-79.3472, 43.6252),
        jsonb_build_array(-79.3472, 43.6942),
        jsonb_build_array(-79.4162, 43.6942),
        jsonb_build_array(-79.4162, 43.6252)
      ))
    ),
    jsonb_build_object(
      'severity', 'medium',
      'summary', 'Bounds all `/api/simulate/disaster` urgent-seed coordinates after jitter.'
    )
  ),
  (
    'ds-blocked-road-financial',
    'disaster',
    'blocked_road',
    'Bay Street closure — structural assessment',
    jsonb_build_object(
      'type', 'LineString',
      'coordinates', jsonb_build_array(
        jsonb_build_array(-79.3795, 43.6465),
        jsonb_build_array(-79.3795, 43.6498)
      )
    ),
    jsonb_build_object('reason', 'structural assessment', 'status', 'closed')
  ),
  (
    'ds-blocked-road-lakeshore-strachan',
    'disaster',
    'blocked_road',
    'Lakeshore Blvd closure at Strachan — debris',
    jsonb_build_object(
      'type', 'LineString',
      'coordinates', jsonb_build_array(
        jsonb_build_array(-79.4055, 43.6332),
        jsonb_build_array(-79.4015, 43.6322)
      )
    ),
    jsonb_build_object(
      'reason', 'debris from collapsed signage',
      'status', 'closed'
    )
  ),
  (
    'ds-staging-exhibition',
    'disaster',
    'responder_staging_area',
    'Exhibition Place responder staging',
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-79.421, 43.6315),
        jsonb_build_array(-79.4172, 43.6315),
        jsonb_build_array(-79.4172, 43.6348),
        jsonb_build_array(-79.421, 43.6348),
        jsonb_build_array(-79.421, 43.6315)
      ))
    ),
    jsonb_build_object('units_capacity', 12)
  )
on conflict (id) do update set
  mode = excluded.mode,
  layer_type = excluded.layer_type,
  name = excluded.name,
  geometry = excluded.geometry,
  metadata = excluded.metadata;
