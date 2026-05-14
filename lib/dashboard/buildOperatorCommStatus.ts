import type { OperatorSendSmsResponse } from "@/lib/types";
import type { CallSession, Incident, OperatorTransferStatus } from "@/lib/types";

export type SmsStatusTone = "default" | "success" | "warning" | "error";

export type SmsStatusView = {
  recipientLabel: string;
  recipientValue: string;
  recipientTone: SmsStatusTone;
  recipientHelp: string;
  deliveryLabel: string;
  deliveryValue: string;
  deliveryTone: SmsStatusTone;
  deliveryHelp?: string;
};

export type TransferStatusView = {
  operatorRequiredLabel: string;
  operatorRequiredTone: "default" | "warning";
  escalationLabel: string;
  escalationTone: "default" | "warning";
  transferLabel: string;
  transferTone: "default" | "warning" | "success" | "error";
  helpText: string;
};

type BuildSmsStatusInput = {
  incident: Incident;
  activeCallSession?: CallSession | null;
  lastSmsResult?: OperatorSendSmsResponse | null;
};

type BuildTransferStatusInput = {
  incident: Incident;
  activeCallSession?: CallSession | null;
};

const transferToneByStatus: Record<
  OperatorTransferStatus,
  TransferStatusView["transferTone"]
> = {
  not_requested: "default",
  requested: "warning",
  transferring: "warning",
  transferred: "success",
  failed: "error",
};

const transferLabelByStatus: Record<OperatorTransferStatus, string> = {
  not_requested: "No active transfer",
  requested: "Transfer requested",
  transferring: "Transfer in progress",
  transferred: "Transfer completed",
  failed: "Transfer failed",
};

export const buildSmsStatusView = ({
  activeCallSession = null,
  lastSmsResult = null,
}: BuildSmsStatusInput): SmsStatusView => {
  const recipient = activeCallSession?.caller_phone?.trim() ?? "";

  const recipientValue =
    recipient.length > 0 ? recipient : "No caller phone is available yet";

  const recipientTone: SmsStatusTone =
    recipient.length > 0 ? "success" : "warning";

  if (!lastSmsResult) {
    return {
      recipientLabel: recipient.length > 0 ? "Caller phone available" : "Caller phone missing",
      recipientValue,
      recipientTone,
      recipientHelp:
        recipient.length > 0
          ? "SMS uses the current caller phone as the fallback recipient."
          : "The backend cannot send SMS without a caller phone or explicit recipient override.",
      deliveryLabel: "Last SMS status",
      deliveryValue: recipient.length > 0 ? "Ready to send" : "Recipient unavailable",
      deliveryTone: recipient.length > 0 ? "default" : "warning",
      deliveryHelp:
        recipient.length > 0
          ? "No SMS has been requested from this panel yet."
          : "Add or recover a recipient before sending SMS from the operator panel.",
    };
  }

  if (lastSmsResult.sent) {
    return {
      recipientLabel: "Caller phone available",
      recipientValue,
      recipientTone: "success",
      recipientHelp: "SMS used the current caller phone fallback unless overridden elsewhere.",
      deliveryLabel: "Last SMS status",
      deliveryValue: "Sent",
      deliveryTone: "success",
      deliveryHelp: lastSmsResult.provider_message_id
        ? `Provider message id: ${lastSmsResult.provider_message_id}`
        : "The backend reported a successful SMS send.",
    };
  }

  if (lastSmsResult.error) {
    const missingRecipient =
      recipient.length === 0 ||
      lastSmsResult.error.toLowerCase().includes("recipient phone number") ||
      lastSmsResult.error.toLowerCase().includes("caller phone");

    return {
      recipientLabel: missingRecipient ? "Caller phone missing" : "Caller phone available",
      recipientValue,
      recipientTone: missingRecipient ? "warning" : recipientTone,
      recipientHelp: missingRecipient
        ? "No recipient was available for the SMS request."
        : "SMS still targets the current caller phone unless overridden elsewhere.",
      deliveryLabel: "Last SMS status",
      deliveryValue: missingRecipient ? "Missing recipient" : "Error",
      deliveryTone: "error",
      deliveryHelp: lastSmsResult.error,
    };
  }

  return {
    recipientLabel: recipient.length > 0 ? "Caller phone available" : "Caller phone missing",
    recipientValue,
    recipientTone,
    recipientHelp:
      recipient.length > 0
        ? "SMS uses the current caller phone as the fallback recipient."
        : "No caller phone was available when the SMS request ran.",
    deliveryLabel: "Last SMS status",
    deliveryValue: "Not sent (provider stub or unavailable)",
    deliveryTone: "warning",
    deliveryHelp:
      "The backend reported sent=false without an explicit error, so no delivery is being claimed.",
  };
};

export const buildTransferStatusView = ({
  incident,
  activeCallSession = null,
}: BuildTransferStatusInput): TransferStatusView => {
  const transferStatus = activeCallSession?.operator_transfer_status ?? "not_requested";
  const operatorRequiredLabel =
    incident.operator_required === null
      ? "Operator requirement unknown"
      : incident.operator_required
        ? "Operator required"
        : "Operator not currently required";

  const escalationLabel =
    activeCallSession?.should_escalate === undefined || activeCallSession === null
      ? "Escalation status unavailable"
      : activeCallSession.should_escalate
        ? "Escalation flagged"
        : "No escalation flagged";

  return {
    operatorRequiredLabel,
    operatorRequiredTone: incident.operator_required ? "warning" : "default",
    escalationLabel,
    escalationTone: activeCallSession?.should_escalate ? "warning" : "default",
    transferLabel: transferLabelByStatus[transferStatus],
    transferTone: transferToneByStatus[transferStatus],
    helpText:
      activeCallSession === null
        ? "Transfer execution is not available from this panel without an active call session."
        : transferStatus === "transferred"
          ? "This status comes from the active session record; the panel is not claiming it completed the transfer itself."
          : "This panel shows transfer state only. It does not trigger call transfer execution by itself.",
  };
};
