import { describe, expect, it } from "vitest";
import { mockCallTriageAgent } from "./mockCallTriageAgent";
import type { ToolResult } from "@/lib/ai/toolResults";

describe("mockCallTriageAgent — geocoding_demo two-pass path", () => {
  it("pass 1: emits a geocode_location tool_request", async () => {
    const out = await mockCallTriageAgent({
      latestTranscript: "demo geocode at Union Station",
      mode: "normal",
    });
    expect(out.tool_requests).toHaveLength(1);

    const geocodeReq = out.tool_requests.find(
      (r) => r.tool === "geocode_location"
    );
    expect(geocodeReq).toBeDefined();
    expect(geocodeReq?.args).toEqual({ location_text: "union station" });

    expect(out.incident_patch.incident_type).toBe("geocoding_demo");
    expect(out.incident_patch.location_status).toBe("unknown");
    expect(out.incident_patch.coordinates).toBeUndefined();
    expect(out.say_to_caller).toMatch(/look that up/i);
  });

  it("pass 1: defaults to Dana Porter Library when no landmark is given", async () => {
    const out = await mockCallTriageAgent({
      latestTranscript: "demo geocode",
      mode: "normal",
    });
    const geocodeReq = out.tool_requests.find(
      (r) => r.tool === "geocode_location"
    );
    expect(geocodeReq?.args).toEqual({
      location_text: "Dana Porter Library",
    });
    expect(out.incident_patch.collected_fields).toEqual({
      demo_location_text: "Dana Porter Library",
    });
  });

  it("pass 2: writes coordinates from the geocode tool result into incident_patch", async () => {
    const toolResults: ToolResult[] = [
      {
        tool_request_id: "tr-1",
        tool: "geocode_location",
        ok: true,
        source: "static_context",
        data: {
          normalized_location: "Union Station, Toronto",
          coordinates: { lat: 43.6453, lng: -79.3806 },
          confidence: 0.95,
          provider_place_id: "mock:union_station",
        },
        created_at: "2026-05-07T20:00:00.000Z",
      },
    ];

    const out = await mockCallTriageAgent({
      latestTranscript: "demo geocode at Union Station",
      mode: "normal",
      toolResults,
    });

    expect(out.tool_requests).toHaveLength(0);
    expect(out.incident_patch.coordinates).toEqual({
      lat: 43.6453,
      lng: -79.3806,
    });
    expect(out.incident_patch.location).toBe("Union Station, Toronto");
    expect(out.incident_patch.location_status).toBe("approximate_by_ai");
    expect(out.incident_patch.location_confidence).toBe(0.95);
    expect(out.say_to_caller).toMatch(/Union Station/i);
    expect(out.incident_patch.recommended_action).toMatch(/Confirm/i);
  });

  it("pass 2: handles a failed geocode tool result gracefully", async () => {
    const toolResults: ToolResult[] = [
      {
        tool_request_id: "tr-1",
        tool: "geocode_location",
        ok: false,
        source: "manual",
        error: { code: "executor_error", message: "geocoder offline" },
        created_at: "2026-05-07T20:00:00.000Z",
      },
    ];
    const out = await mockCallTriageAgent({
      latestTranscript: "demo geocode at somewhere obscure",
      mode: "normal",
      toolResults,
    });
    expect(out.incident_patch.coordinates).toBeUndefined();
    expect(out.incident_patch.location_status).toBe("unknown");
    expect(out.say_to_caller).toMatch(/could not resolve/i);
  });
});
