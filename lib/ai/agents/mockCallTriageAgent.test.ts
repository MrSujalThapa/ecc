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
        status: "success",
        source: "static_context",
        args: { location_text: "union station" },
        latency_ms: 12,
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
        status: "error",
        source: "manual",
        args: { location_text: "somewhere obscure" },
        latency_ms: 10,
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

  it("emits geocode_location for explicit addresses in ordinary transcripts", async () => {
    const out = await mockCallTriageAgent({
      latestTranscript:
        "Someone kidnapped my child at 110 University Ave W, Waterloo, Ontario.",
      mode: "normal",
    });

    const geocodeReq = out.tool_requests.find(
      (r) => r.tool === "geocode_location",
    );
    expect(geocodeReq).toBeDefined();
    expect(geocodeReq?.args).toEqual({
      location_text: "110 university ave w, waterloo, ontario",
      city_context: "Waterloo",
      country_context: "Canada",
    });
    expect(out.incident_patch.location).toBe(
      "110 university ave w, waterloo, ontario",
    );
    expect(out.incident_patch.location_status).toBe("unknown");
  });

  it("emits geocode_location for strong landmark phrases in ordinary transcripts", async () => {
    const out = await mockCallTriageAgent({
      latestTranscript:
        "There is smoke near the CN Tower, 290 Bremner Blvd, Toronto.",
      mode: "normal",
    });

    const geocodeReq = out.tool_requests.find(
      (r) => r.tool === "geocode_location",
    );
    expect(geocodeReq).toBeDefined();
    expect(geocodeReq?.args).toEqual({
      location_text: "290 bremner blvd, toronto",
      city_context: "Toronto",
    });
  });

  it("does not emit geocode_location for non-location transcripts", async () => {
    const out = await mockCallTriageAgent({
      latestTranscript: "Someone stole my bike and I am really upset.",
      mode: "normal",
    });

    expect(
      out.tool_requests.some((request) => request.tool === "geocode_location"),
    ).toBe(false);
  });

  it("folds tool results into ordinary transcript incidents on pass 2", async () => {
    const toolResults: ToolResult[] = [
      {
        tool_request_id: "tr-2",
        tool: "geocode_location",
        ok: true,
        status: "success",
        source: "mapbox_mcp",
        args: { location_text: "110 university ave w, waterloo, ontario" },
        latency_ms: 25,
        data: {
          normalized_location: "110 University Ave W, Waterloo, Ontario",
          coordinates: { lat: 43.4643, lng: -80.5204 },
          confidence: 0.99,
          provider_place_id: "mbx.waterloo",
        },
        created_at: "2026-05-07T20:00:00.000Z",
      },
    ];

    const out = await mockCallTriageAgent({
      latestTranscript:
        "Someone kidnapped my child at 110 University Ave W, Waterloo, Ontario.",
      mode: "normal",
      toolResults,
    });

    expect(out.tool_requests).toEqual([]);
    expect(out.incident_patch.location).toBe(
      "110 University Ave W, Waterloo, Ontario",
    );
    expect(out.incident_patch.coordinates).toEqual({
      lat: 43.4643,
      lng: -80.5204,
    });
    expect(out.incident_patch.location_status).toBe("approximate_by_ai");
    expect(out.incident_patch.location_confidence).toBe(0.99);
  });
});
