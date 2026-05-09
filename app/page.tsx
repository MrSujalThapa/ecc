import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: incidents, error } = await supabase
    .from("incidents")
    .select("id, public_id, status, urgency")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 px-6 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Emergency dashboard demo
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Home page loads up to 10 rows from{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
            incidents
          </code>{" "}
          via the server Supabase client. RLS is on with no policies yet, so this
          query may return empty or error until you add policies or use the service
          role from API routes.
        </p>
        {error ? (
          <p
            className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
            <strong className="font-medium">Supabase</strong>: {error.message}
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {incidents && incidents.length > 0 ? (
              incidents.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="font-mono text-xs text-zinc-500">
                    {row.public_id ?? row.id}
                  </span>
                  <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
                  {row.status} / {row.urgency}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-600 dark:text-zinc-400">
                No rows returned (empty table or RLS blocking anon reads).
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
};
