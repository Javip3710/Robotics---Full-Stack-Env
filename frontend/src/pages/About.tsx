import { Card } from "../components/ui";

const sections = [
  { title: "Team overview", body: "Placeholder — the team will provide this section's content." },
  { title: "Mission", body: "Placeholder — the team will provide this section's content." },
  { title: "Subteams", body: "Placeholder — the team will provide this section's content." },
  { title: "Getting involved", body: "Placeholder — the team will provide this section's content." },
  { title: "Contact", body: "Placeholder — the team will provide public contact information." },
];

export default function About() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">example</h1>
        <p className="mt-1 text-slate-600">
          Who we are, what we do, and how to get involved.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title} className="p-6">
            <h2 className="font-semibold text-slate-900">{s.title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {s.body}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
