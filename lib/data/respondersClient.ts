import type { Responder, RespondersMockResponse } from "@/lib/types";

export type RespondersClient = {
  getResponders(): Promise<Responder[]>;
};

export const respondersClient: RespondersClient = {
  async getResponders() {
    const response = await fetch("/api/responders/mock", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Responder API returned ${response.status}`);
    }

    const payload = (await response.json()) as RespondersMockResponse;
    return Array.isArray(payload.responders) ? payload.responders : [];
  },
};
