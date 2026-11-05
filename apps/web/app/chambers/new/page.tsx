"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, ErrorNote, Input, TextArea } from "@/components/ui";

const EXAMPLES: Record<string, { title: string; question: string }> = {
  decision: { title: "March trip", question: "Where should we go in March, and what's our budget?" },
  disagreement: { title: "Weekend plans", question: "How should we spend our weekends?" },
  household: { title: "Chores", question: "How should we split the chores in the flat?" },
};

function NewChamberInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [template, setTemplate] = useState(params.get("template") || "decision");
  const [templates, setTemplates] = useState<Record<string, { label: string; description: string }>>({});
  const [title, setTitle] = useState(params.get("title") || "");
  const [question, setQuestion] = useState(params.get("question") || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/templates").then(setTemplates);
  }, []);

  async function create() {
    setError(null);
    try {
      const ch = await api("/chambers", { body: { template, title, question } });
      router.push(`/chambers/${ch.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="label-mono text-ink-2">New Chamber</div>
      <h1 className="font-display text-4xl">What are you trying to work out?</h1>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {Object.entries(templates).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setTemplate(k)}
            className={`rounded-lg border p-3 text-left ${template === k ? "border-ink bg-white" : "hairline hover:border-ink"}`}
          >
            <div className="font-display text-lg">{t.label}</div>
            <div className="text-xs text-ink-2">{t.description}</div>
          </button>
        ))}
      </div>
      <Card className="mt-6 space-y-4">
        <label className="block text-sm">
          Short title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={EXAMPLES[template]?.title} />
        </label>
        <label className="block text-sm">
          The question, phrased neutrally
          <TextArea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={EXAMPLES[template]?.question} />
        </label>
        <p className="text-xs text-ink-2">
          Phrase it so everyone involved would accept the wording. “How should we split chores?”, not “Why won’t Sam do the dishes?”
        </p>
        <Button onClick={create} disabled={title.trim().length < 2 || question.trim().length < 5}>
          Create Chamber
        </Button>
        <ErrorNote error={error} />
      </Card>
    </div>
  );
}

export default function NewChamber() {
  return (
    <Suspense>
      <NewChamberInner />
    </Suspense>
  );
}
