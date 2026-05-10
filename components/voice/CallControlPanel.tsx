"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Incident, OperatorUpdateIncidentRequest } from "@/lib/types";
import type { OperatorActions } from "@/lib/data/operatorActions";
import { getIncidentDisplayId } from "@/lib/map/incidentStyling";

type CallControlPanelProps = {
  incident: Incident;
  operatorActions: OperatorActions;
  onActionComplete: () => Promise<void> | void;
  operatorId?: string;
};

type ActionName = "takeover" | "resolve" | "sms" | "note";

type ActionFeedback = {
  tone: "success" | "neutral" | "error";
  message: string;
} | null;

function defaultSmsMessage(incident: Incident) {
  const id = getIncidentDisplayId(incident);
  const summary = incident.summary ?? "Your report has been received.";

  return `${id}: ${summary}`.slice(0, 240);
}

export function CallControlPanel({
  incident,
  operatorActions,
  onActionComplete,
  operatorId = "OP-1",
}: CallControlPanelProps) {
  const [activeAction, setActiveAction] = useState<ActionName | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);
  const [smsMessage, setSmsMessage] = useState(() => defaultSmsMessage(incident));
  const [note, setNote] = useState("");

  const resolved = incident.status === "resolved" || incident.status === "abandoned";
  const actionInProgress = activeAction !== null;
  const noteDisabled = note.trim().length === 0 || actionInProgress;

  const actionLabel = useMemo(() => {
    switch (activeAction) {
      case "takeover":
        return "Taking over...";
      case "resolve":
        return "Resolving...";
      case "sms":
        return "Sending SMS request...";
      case "note":
        return "Updating incident...";
      default:
        return null;
    }
  }, [activeAction]);

  async function runAction(
    name: ActionName,
    action: () => Promise<{
      tone?: "success" | "neutral" | "error";
      message: string;
    }>,
  ) {
    setActiveAction(name);
    setFeedback(null);

    try {
      const result = await action();
      await onActionComplete();
      setFeedback({
        tone: result.tone ?? "success",
        message: result.message,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The operator action failed unexpectedly.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  function handleTakeover() {
    void runAction("takeover", async () => {
      await operatorActions.takeOverIncident({
        incident_id: incident.id,
        operator_id: operatorId,
      });

      return {
        message:
          "Takeover complete. You are in control of this incident (human active), AI intake is off, and any active call session was closed.",
      };
    });
  }

  function handleResolve() {
    void runAction("resolve", async () => {
      await operatorActions.resolveIncident({
        incident_id: incident.id,
        operator_id: operatorId,
        resolution_note: note.trim() || null,
      });

      return { message: "Incident marked resolved and dashboard feed refreshed." };
    });
  }

  function handleSendSms() {
    void runAction("sms", async () => {
      const result = await operatorActions.sendSms({
        incident_id: incident.id,
        operator_id: operatorId,
        message: smsMessage,
      });

      if (result.sent) {
        return {
          message: result.provider_message_id
            ? `SMS sent. Provider message: ${result.provider_message_id}.`
            : "SMS sent.",
        };
      }

      if (result.error) {
        return {
          tone: "error",
          message: result.error,
        };
      }

      return {
        tone: "neutral",
        message:
          "SMS was not sent (Twilio may be disabled or the send failed). Check server logs.",
      };
    });
  }

  function handleAddNote() {
    const trimmedNote = note.trim();

    if (!trimmedNote) {
      return;
    }

    void runAction("note", async () => {
      const existingFields = Array.isArray(incident.custom_fields)
        ? incident.custom_fields
        : [];
      const patch: OperatorUpdateIncidentRequest["patch"] = {
        custom_fields: [
          ...existingFields,
          {
            type: "operator_note",
            note: trimmedNote,
            operator_id: operatorId,
            created_at: new Date().toISOString(),
          },
        ],
      };

      await operatorActions.updateIncident({
        incident_id: incident.id,
        operator_id: operatorId,
        patch,
      });

      setNote("");
      return { message: "Operator note added and incident refreshed." };
    });
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        Operator Actions
      </h3>
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#040f16] p-4">
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            disabled={actionInProgress || resolved}
            loading={activeAction === "takeover"}
            onClick={handleTakeover}
          >
            Take Over
          </ActionButton>
          <ActionButton
            disabled={actionInProgress || resolved}
            loading={activeAction === "resolve"}
            onClick={handleResolve}
          >
            Mark Resolved
          </ActionButton>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          SMS message
          <textarea
            value={smsMessage}
            onChange={(event) => setSmsMessage(event.target.value)}
            className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-[#000814] px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300"
          />
        </label>
        <ActionButton
          disabled={actionInProgress || smsMessage.trim().length === 0}
          loading={activeAction === "sms"}
          onClick={handleSendSms}
        >
          Send SMS
        </ActionButton>

        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add operator note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add operational context or a resolution note..."
            className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-[#000814] px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
          />
        </label>
        <ActionButton
          disabled={noteDisabled}
          loading={activeAction === "note"}
          onClick={handleAddNote}
        >
          Add Note / Update Incident
        </ActionButton>

        {actionLabel ? (
          <p className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
            {actionLabel}
          </p>
        ) : null}

        {feedback ? (
          <p
            className={`rounded-xl border px-3 py-2 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                : feedback.tone === "neutral"
                  ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                  : "border-red-400/20 bg-red-500/10 text-red-100"
            }`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ActionButton({
  children,
  disabled,
  loading = false,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-busy={loading}
      className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {loading ? "Working..." : children}
    </button>
  );
}
