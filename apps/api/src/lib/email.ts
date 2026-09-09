import { env } from './env';

/** Transactional email via Resend's REST API — one endpoint, so no SDK.
 * Same posture as Stripe: unconfigured is a supported state (dev without a
 * key), and the features that need email report themselves unavailable. */

export function emailConfigured(): boolean {
  // Vitest sets NODE_ENV=test — the suite registers throwaway accounts, and
  // real sends to their fake addresses would bounce (burning quota and the
  // domain's sender reputation, since the local .env holds a live key).
  if (env.nodeEnv === 'test') return false;
  return env.resendApiKey.length > 0;
}

/** Sends one email. Throws on failure — callers decide whether that failure
 * is fatal (password reset: yes) or best-effort (signup verification: no). */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Resend's error body can name the recipient — log status only.
    throw new Error(`Resend responded ${res.status}`);
  }
}

/** Minimal shared shell: readable in every client, no images or trackers —
 * transactional mail from a privacy-first product should look the part. */
function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e7e5e4">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#6366f1">ATLAS</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#1c1917">${title}</h1>
    ${bodyHtml}
    <p style="margin:20px 0 0;font-size:12px;color:#78716c">If you didn’t request this, you can safely ignore this email.</p>
  </div>
</body></html>`;
}

function linkButton(url: string, label: string): string {
  return `<p style="margin:16px 0"><a href="${url}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">${label}</a></p>
<p style="margin:0;font-size:12px;color:#78716c;word-break:break-all">Or paste this link into your browser:<br>${url}</p>`;
}

export function passwordResetEmail(url: string): { subject: string; html: string } {
  return {
    subject: 'Reset your Atlas password',
    html: emailShell(
      'Reset your password',
      `<p style="margin:0;font-size:14px;color:#44403c">Click the button below to choose a new password. This link works once and expires in 30 minutes.</p>
${linkButton(url, 'Reset password')}`,
    ),
  };
}

export function accountDeletionEmail(graceDays: number): { subject: string; html: string } {
  return {
    subject: 'Your Atlas account is scheduled for deletion',
    html: emailShell(
      'Account scheduled for deletion',
      `<p style="margin:0;font-size:14px;color:#44403c">Your account and all its data will be permanently deleted in ${graceDays} days. Any subscription has been cancelled — you won’t be charged again.</p>
<p style="margin:12px 0 0;font-size:14px;color:#44403c">Changed your mind? Just sign back in within ${graceDays} days and your account will be restored exactly as you left it.</p>`,
    ),
  };
}

export function verifyEmailEmail(url: string): { subject: string; html: string } {
  return {
    subject: 'Verify your email for Atlas',
    html: emailShell(
      'Verify your email',
      `<p style="margin:0;font-size:14px;color:#44403c">Confirm this is your email address to secure your Atlas account. This link expires in 24 hours.</p>
${linkButton(url, 'Verify email')}`,
    ),
  };
}
