import { NextResponse } from "next/server";
import {
  runSurgeGeoOpsAgent,
  type SurgeGeoOpsMode,
} from "@/lib/ai/agents/surgeGeoOpsAgent";
import { listAllIncidentsSorted } from "@/lib/server/demo-store";
import { getMockResponders } from "@/lib/server/responders-mock-data";

type SurgeAnalyzeProvider = "mock" | "featherless";

type SurgeAnalyzeBody = {
  mode?: unknown;
  activeIncidents?: unknown;
  responders?: unknown;
  eventLayers?: unknown;
  recentToolResults?: unknown;
  provider?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asRecordArray = (value: unknown): Array<Record<string, unknown>> | null =>
  Array.isArray(value) ? value.filter(isRecord) : null;

const hasOwn = (value: object, key: keyof SurgeAnalyzeBody): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const normalizeMode = (value: unknown): SurgeGeoOpsMode =>
  value === "world_cup" ? "world_cup" : "disaster";

const normalizeProvider = (value: unknown): SurgeAnalyzeProvider | undefined =>
  value === "mock" || value === "featherless" ? value : undefined;

const loadDemoStoreIncidents = (
  mode: SurgeGeoOpsMode
): Array<Record<string, unknown>> =>
  listAllIncidentsSorted()
    .filter(
      (incident) =>
        incident.mode === mode &&
        incident.status !== "resolved" &&
        incident.status !== "abandoned"
    )
    .map((incident) => ({ ...incident }));

const safeErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "surge analysis failed";

export const POST = async (request: Request): Promise<NextResponse> => {
  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim() !== "") {
      rawBody = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  try {
    const body: SurgeAnalyzeBody = isRecord(rawBody) ? rawBody : {};
    const mode = normalizeMode(body.mode);
    const activeIncidents = hasOwn(body, "activeIncidents")
      ? asRecordArray(body.activeIncidents) ?? []
      : loadDemoStoreIncidents(mode);
    const responders = hasOwn(body, "responders")
      ? asRecordArray(body.responders) ?? []
      : getMockResponders().map((responder) => ({ ...responder }));
    const eventLayers = hasOwn(body, "eventLayers")
      ? asRecordArray(body.eventLayers) ?? []
      : [];
    const recentToolResults = Array.isArray(body.recentToolResults)
      ? body.recentToolResults
      : [];
    const provider =
      normalizeProvider(body.provider) ?? normalizeProvider(process.env.AI_PROVIDER);

    const analysis = await runSurgeGeoOpsAgent({
      mode,
      activeIncidents,
      responders,
      eventLayers,
      recentToolResults,
      provider,
    });

    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { message: safeErrorMessage(error) } },
      { status: 500 }
    );
  }
};
