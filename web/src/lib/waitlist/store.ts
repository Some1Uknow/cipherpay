import "server-only";

import { getDb } from "@/lib/db";

type CreateWaitlistSignupInput = {
  email: string;
  feedback?: string | null;
};

export const createWaitlistSignup = async ({ email, feedback }: CreateWaitlistSignupInput): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanFeedback = feedback?.trim() ? feedback.trim() : null;

  await getDb().query(
    `
      INSERT INTO waitlist_signups (email, email_normalized, feedback)
      VALUES ($1, $2, $3)
      ON CONFLICT (email_normalized)
      DO UPDATE SET
        feedback = COALESCE(EXCLUDED.feedback, waitlist_signups.feedback),
        updated_at = NOW()
    `,
    [email.trim(), normalizedEmail, cleanFeedback],
  );
};

