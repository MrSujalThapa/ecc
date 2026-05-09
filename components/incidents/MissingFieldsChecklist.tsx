type MissingFieldsChecklistProps = {
  fields: string[];
};

export function MissingFieldsChecklist({ fields }: MissingFieldsChecklistProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-slate-400">No missing fields.</p>;
  }

  return (
    <ul className="space-y-2">
      {fields.map((field) => (
        <li
          key={field}
          className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
        >
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          {field.replaceAll("_", " ")}
        </li>
      ))}
    </ul>
  );
}
