import { NextResponse } from "next/server";
import type { RespondersMockResponse } from "@/lib/types/api";
import { getMockResponders } from "@/lib/server/responders-mock-data";

export const GET = async (): Promise<NextResponse> => {
  const payload: RespondersMockResponse = { responders: getMockResponders() };
  return NextResponse.json(payload);
};
