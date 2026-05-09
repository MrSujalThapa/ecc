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

export type OperatorActions = {
  takeOverIncident(
    input: OperatorTakeoverRequest,
  ): Promise<OperatorTakeoverResponse>;
  updateIncident(
    input: OperatorUpdateIncidentRequest,
  ): Promise<OperatorUpdateIncidentResponse>;
  resolveIncident(input: OperatorResolveRequest): Promise<OperatorResolveResponse>;
  sendSms(input: OperatorSendSmsRequest): Promise<OperatorSendSmsResponse>;
};
