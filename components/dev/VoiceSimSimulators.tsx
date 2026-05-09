"use client";

import dynamic from "next/dynamic";

const ElevenLabsVoiceSimulator = dynamic(
  () =>
    import("@/components/dev/ElevenLabsVoiceSimulator").then((m) => ({
      default: m.ElevenLabsVoiceSimulator,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Loading voice simulator…
      </div>
    ),
  },
);

const OperatorFlowSimulator = dynamic(
  () =>
    import("@/components/dev/OperatorFlowSimulator").then((m) => ({
      default: m.OperatorFlowSimulator,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Loading operator simulator…
      </div>
    ),
  },
);

export const VoiceSimSimulators = () => {
  return (
    <>
      <ElevenLabsVoiceSimulator />
      <div className="mx-auto my-12 h-px w-full max-w-3xl bg-zinc-200 dark:bg-zinc-800" />
      <OperatorFlowSimulator />
    </>
  );
};
