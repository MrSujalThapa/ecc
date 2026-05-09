import { z } from "zod";

const nonNegativeNumberSchema = z.number().min(0);
const scoreSchema = z.number().min(0).max(1);

export const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const urgencyBreakdownSchema = z.object({
  unknown: nonNegativeNumberSchema,
  non_emergency: nonNegativeNumberSchema,
  urgent: nonNegativeNumberSchema,
  critical: nonNegativeNumberSchema,
});

export const surgeClusterSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(["disaster", "world_cup"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  center: coordinatesSchema,
  radius_meters: nonNegativeNumberSchema,
  incident_ids: z.array(z.string()),
  incident_count: nonNegativeNumberSchema,
  urgency_breakdown: urgencyBreakdownSchema,
  top_recommended_action: z.string().nullable(),
  priority_score: scoreSchema,
});

export const routeRecommendationSchema = z.object({
  id: z.string().min(1),
  from: coordinatesSchema,
  to: coordinatesSchema,
  profile: z.enum(["driving", "walking", "cycling"]),
  distance_meters: nonNegativeNumberSchema,
  duration_seconds: nonNegativeNumberSchema,
  geometry: z.unknown().optional(),
  reason: z.string().min(1),
  warnings: z.array(z.string()),
});

export const responderRecommendationSchema = z.object({
  responder_id: z.string().min(1),
  display_name: z.string().min(1),
  type: z.enum(["ambulance", "fire", "police", "event_staff"]),
  status: z.enum(["available", "assigned", "en_route", "busy", "offline"]),
  coordinates: coordinatesSchema,
  distance_meters: nonNegativeNumberSchema,
  estimated_travel_seconds: nonNegativeNumberSchema.nullable().optional(),
  reason: z.string().min(1),
});

export const helpPointRecommendationSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "medical_tent",
    "police_tent",
    "security_tent",
    "lost_and_found",
    "tourist_help",
    "transit_node",
    "shelter",
    "mechanic_or_roadside_help",
  ]),
  name: z.string().min(1),
  coordinates: coordinatesSchema,
  distance_meters: nonNegativeNumberSchema,
  route_summary: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()),
});

export const eventZoneMatchSchema = z.object({
  layer_id: z.string().min(1),
  name: z.string().min(1),
  layer_type: z.string().min(1),
  distance_meters: nonNegativeNumberSchema.nullable().optional(),
  contains_location: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
});

export const geoOpsRecommendationSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "operator_focus",
    "route",
    "responder_assignment",
    "help_point",
    "cluster_attention",
    "blocked_road_warning",
  ]),
  title: z.string().min(1),
  summary: z.string().min(1),
  incident_ids: z.array(z.string()),
  route_ids: z.array(z.string()).optional(),
  responder_ids: z.array(z.string()).optional(),
  event_layer_ids: z.array(z.string()).optional(),
  priority_score: scoreSchema,
  requires_operator_confirmation: z.boolean(),
});

export const surgeGeoOpsAgentOutputSchema = z.object({
  schema_version: z.literal("1.0"),
  mode: z.enum(["disaster", "world_cup"]),
  clusters: z.array(surgeClusterSchema),
  top_priority_incident_ids: z.array(z.string()),
  route_recommendations: z.array(routeRecommendationSchema),
  responder_recommendations: z.array(responderRecommendationSchema),
  help_point_recommendations: z.array(helpPointRecommendationSchema),
  event_zone_matches: z.array(eventZoneMatchSchema),
  geoops_recommendations: z.array(geoOpsRecommendationSchema),
  summary: z.string(),
  confidence: scoreSchema,
});

export type Coordinates = z.infer<typeof coordinatesSchema>;
export type SurgeCluster = z.infer<typeof surgeClusterSchema>;
export type RouteRecommendation = z.infer<typeof routeRecommendationSchema>;
export type ResponderRecommendation = z.infer<
  typeof responderRecommendationSchema
>;
export type HelpPointRecommendation = z.infer<
  typeof helpPointRecommendationSchema
>;
export type EventZoneMatch = z.infer<typeof eventZoneMatchSchema>;
export type GeoOpsRecommendation = z.infer<typeof geoOpsRecommendationSchema>;
export type SurgeGeoOpsAgentOutput = z.infer<
  typeof surgeGeoOpsAgentOutputSchema
>;

export type SurgeGeoOpsAgentValidationIssue = {
  path: (string | number | symbol)[];
  message: string;
  code?: string;
};

export class SurgeGeoOpsAgentOutputValidationError extends Error {
  readonly issues: SurgeGeoOpsAgentValidationIssue[];

  constructor(message: string, issues: SurgeGeoOpsAgentValidationIssue[]) {
    super(message);
    this.name = "SurgeGeoOpsAgentOutputValidationError";
    this.issues = issues;
  }
}

export function validateSurgeGeoOpsAgentOutput(
  input: unknown
): SurgeGeoOpsAgentOutput {
  const result = surgeGeoOpsAgentOutputSchema.safeParse(input);
  if (!result.success) {
    const issues: SurgeGeoOpsAgentValidationIssue[] = result.error.issues.map(
      (issue) => ({
        path: [...issue.path],
        message: issue.message,
        code: issue.code,
      })
    );
    const summary = issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new SurgeGeoOpsAgentOutputValidationError(
      `Invalid SurgeGeoOpsAgentOutput: ${summary}`,
      issues
    );
  }

  return result.data;
}
