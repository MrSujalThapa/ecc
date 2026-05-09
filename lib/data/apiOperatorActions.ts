import type {
  OperatorResolveRequest,
  OperatorResolveResponse,
  OperatorSendSmsRequest,
  OperatorSendSmsResponse,
  OperatorTakeoverRequest,
  OperatorTakeoverResponse,
  OperatorUpdateIncidentRequest,
  OperatorUpdateIncidentResponse,
} from "@/lib/types";
import type { OperatorActions } from "./operatorActions";
import { postJson, type PostJsonResult } from "@/lib/http/postJson";

function getApiErrorMessage<TResponse>(
  path: string,
  result: PostJsonResult<TResponse>,
) {
  if (result.data && typeof result.data === "object" && "error" in result.data) {
    const error = (result.data as { error?: { message?: string } }).error;
    if (error?.message) {
      return `${path} returned ${result.status}: ${error.message}`;
    }
  }

  const detail = result.errorText.trim();
  return detail
    ? `${path} returned ${result.status}: ${detail.slice(0, 300)}`
    : `${path} returned ${result.status}`;
}

async function postOperatorJson<TResponse, TRequest>(
  path: string,
  body: TRequest,
): Promise<TResponse> {
  const result = await postJson<TResponse>(path, body);

  if (!result.ok || result.data === null) {
    throw new Error(getApiErrorMessage(path, result));
  }

  return result.data;
}

export const apiOperatorActions: OperatorActions = {
  takeOverIncident(input: OperatorTakeoverRequest) {
    return postOperatorJson<OperatorTakeoverResponse, OperatorTakeoverRequest>(
      "/api/operator/takeover",
      input,
    );
  },

  updateIncident(input: OperatorUpdateIncidentRequest) {
    return postOperatorJson<
      OperatorUpdateIncidentResponse,
      OperatorUpdateIncidentRequest
    >("/api/operator/update-incident", input);
  },

  resolveIncident(input: OperatorResolveRequest) {
    return postOperatorJson<OperatorResolveResponse, OperatorResolveRequest>(
      "/api/operator/resolve",
      input,
    );
  },

  sendSms(input: OperatorSendSmsRequest) {
    return postOperatorJson<OperatorSendSmsResponse, OperatorSendSmsRequest>(
      "/api/operator/send-sms",
      input,
    );
  },
};
