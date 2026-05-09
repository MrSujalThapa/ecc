/**
 * Typed wrappers for dashboard operator APIs (`docs/api_contracts.md` §4.4–4.7).
 */

import { postJson } from "@/lib/http/postJson";
import type {
  OperatorResolveRequest,
  OperatorResolveResponse,
  OperatorSendSmsRequest,
  OperatorSendSmsResponse,
  OperatorTakeoverRequest,
  OperatorTakeoverResponse,
  OperatorUpdateIncidentRequest,
  OperatorUpdateIncidentResponse,
} from "@/lib/types/api";

export const dashboardPostOperatorTakeover = (body: OperatorTakeoverRequest) =>
  postJson<OperatorTakeoverResponse>("/api/operator/takeover", body);

export const dashboardPostOperatorUpdateIncident = (
  body: OperatorUpdateIncidentRequest
) => postJson<OperatorUpdateIncidentResponse>("/api/operator/update-incident", body);

export const dashboardPostOperatorResolve = (body: OperatorResolveRequest) =>
  postJson<OperatorResolveResponse>("/api/operator/resolve", body);

export const dashboardPostOperatorSendSms = (body: OperatorSendSmsRequest) =>
  postJson<OperatorSendSmsResponse>("/api/operator/send-sms", body);
