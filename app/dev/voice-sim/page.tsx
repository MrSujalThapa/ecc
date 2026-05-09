import Link from "next/link";
import { VoiceSimSimulators } from "@/components/dev/VoiceSimSimulators";

export default function VoiceSimPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="mx-auto mb-8 w-full max-w-3xl">
        <Link
          href="/"
          className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          E2E voice + operator simulators
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Voice block mimics ElevenLabs transcript payloads against{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
            /api/call/*
          </code>
          . The operator block loads incidents via{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
            GET /api/dev/incidents
          </code>{" "}
          (Supabase when the service role is set, otherwise the in-memory demo
          store) and drives{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
            /api/operator/*
          </code>
          .
        </p>
      </header>
      <VoiceSimSimulators />
    </div>
  );
}
