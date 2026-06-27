"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type WaitlistModalProps = {
  buttonClassName?: string;
  buttonSize?: "sm" | "md" | "lg";
  buttonVariant?: "primary" | "secondary" | "ghost" | "danger";
};

export function WaitlistModal({
  buttonClassName,
  buttonSize = "lg",
  buttonVariant = "primary",
}: WaitlistModalProps) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [feedback, setFeedback] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, feedback }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error ?? "Could not join the waitlist right now.");
      return;
    }

    setStatus("success");
    setMessage("You are on the waitlist. We will reach out when access opens.");
    setFeedback("");
  };

  return (
    <>
      <Button variant={buttonVariant} size={buttonSize} className={buttonClassName} onClick={() => setOpen(true)}>
        Join waitlist
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-lg border border-[#111] bg-[var(--brand-surface)] p-5 shadow-neo sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Private access
                </p>
                <h2 className="font-display mt-2 text-3xl tracking-[-0.055em] text-[var(--brand-ink-deep)]">
                  Join the CipherPay waitlist
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--brand-muted-ink)]">
                  Leave your email and optional context. Access is invite-only while the app is in waitlist mode.
                </p>
              </div>
              <button
                type="button"
                className="border border-[var(--brand-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--brand-ink)] hover:border-[#111]"
                onClick={() => setOpen(false)}
                aria-label="Close waitlist modal"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-semibold text-[var(--brand-ink)]">
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--brand-ink)]">
                Optional feedback
                <Textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="What would you use private payroll or agent invoicing for?"
                  maxLength={2000}
                />
              </label>

              {message ? (
                <p className={status === "error" ? "text-sm font-semibold text-[var(--brand-danger)]" : "text-sm font-semibold text-[var(--brand-success)]"}>
                  {message}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
                {status === "submitting" ? "Joining..." : "Join waitlist"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

