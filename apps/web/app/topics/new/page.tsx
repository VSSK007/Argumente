"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorNote, Input, TextArea } from "@/components/ui";

export default function NewTopic() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [seeds, setSeeds] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-xl">
      <div className="label-mono text-ink-2">New public topic</div>
      <h1 className="font-display text-4xl">Ask a question people disagree on</h1>
      <Card className="mt-6 space-y-4">
        <label className="block text-sm">
          The question, phrased neutrally
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How should flatmates split rent?" />
        </label>
        <label className="block text-sm">
          Context (optional)
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block text-sm">
          Starting statements, one per line (optional, up to 10)
          <TextArea rows={5} value={seeds} onChange={(e) => setSeeds(e.target.value)} placeholder={"Rent should follow room size\nShared rooms are most of what rent pays for"} />
        </label>
        <p className="text-xs text-ink-2">
          Seed a few statements from different sides so the first voters have something to react to. Everything here is public and anonymous.
        </p>
        <Button
          disabled={question.trim().length < 8}
          onClick={async () => {
            setError(null);
            try {
              const r = await api("/topics", { body: { question, description: description || null, seed_statements: seeds.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10) } });
              router.push(`/topics/${r.slug}`);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          Start the topic
        </Button>
        <ErrorNote error={error} />
      </Card>
    </div>
  );
}
