"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteGateForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setSubmitting(false);
      setError(payload.error ?? "Invalid invite code.");
      return;
    }

    router.replace(nextPath.startsWith("/") ? nextPath : "/pay");
    router.refresh();
  };

  return (
    <form className="mt-6 grid gap-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-semibold text-[var(--brand-ink)]">
        Invite code
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter your invite code"
          autoFocus
          required
        />
      </label>
      {error ? <p className="text-sm font-semibold text-[var(--brand-danger)]">{error}</p> : null}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Checking..." : "Unlock access"}
      </Button>
    </form>
  );
}
