import { Resend } from 'resend';
import { serverEnv } from '@/env/server';

const DEFAULT_FROM = 'Core Lens AI <noreply@core-lens.ai>';

// Email clients load images from the public internet, so assets always point at the production domain.
const SITE_URL = 'https://core-lens.ai';
const LOGO_URL = `${SITE_URL}/email/logo.png`;
const SUPPORT_EMAIL = 'haziqbangash@core-lens.ai';

let client: Resend | null = null;
const getClient = () => (client ??= new Resend(serverEnv.RESEND_API_KEY));

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends a transactional email through Resend. Throws if delivery fails so callers
 * (and better-auth) can surface the error instead of silently dropping the email.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const { error } = await getClient().emails.send({
    from: serverEnv.EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject,
    html,
    text,
    replyTo: SUPPORT_EMAIL,
  });

  if (error) {
    console.error('[email] Failed to send email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

interface ActionEmailOptions {
  /** Inbox preview text shown next to the subject. */
  preheader: string;
  heading: string;
  /** Plain-text paragraphs rendered above the button. */
  paragraphs: string[];
  buttonLabel: string;
  url: string;
  /** Small print under the button, e.g. expiry and "didn't request this". */
  notes: string[];
  recipient: string;
}

export function renderActionEmail({
  preheader,
  heading,
  paragraphs,
  buttonLabel,
  url,
  notes,
  recipient,
}: ActionEmailOptions) {
  const safeUrl = escapeHtml(url);
  const year = new Date().getFullYear();

  const paragraphHtml = paragraphs
    .map(
      (p) =>
        `<p class="text" style="margin:0 0 16px 0;font-size:16px;line-height:26px;color:#3f3f38;">${escapeHtml(p)}</p>`,
    )
    .join('');

  const noteHtml = notes
    .map(
      (n) =>
        `<p class="muted" style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#5c5c52;">${escapeHtml(n)}</p>`,
    )
    .join('');

  // Hidden filler stops email clients from pulling body text into the inbox preview.
  const preheaderFiller = '&#847;&zwnj;&nbsp;'.repeat(60);

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(heading)}</title>
    <!--[if mso]>
      <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
      @media only screen and (max-width: 520px) {
        .container { width: 100% !important; }
        .card { padding: 32px 24px !important; }
        .heading { font-size: 24px !important; line-height: 32px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .body-bg { background-color: #0c1618 !important; }
        .card { background-color: #152224 !important; border-color: #243538 !important; }
        .heading { color: #e8ebe6 !important; }
        .text { color: #c9cfc9 !important; }
        .muted, .muted a { color: #8d9a98 !important; }
        .divider { border-color: #243538 !important; }
        .btn-cell { background-color: #4a9e9a !important; }
        .btn-link { color: #0c1618 !important; background-color: #4a9e9a !important; border-color: #4a9e9a !important; }
        .link { color: #7fc4c0 !important; }
      }
    </style>
  </head>
  <body class="body-bg" style="margin:0;padding:0;width:100%;background-color:#f4f0e5;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f0e5;opacity:0;">
      ${escapeHtml(preheader)}${preheaderFiller}
    </div>

    <table role="presentation" class="body-bg" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f0e5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" class="container" width="520" cellspacing="0" cellpadding="0" border="0" style="width:520px;max-width:520px;">
            <!-- Brand -->
            <tr>
              <td align="left" style="padding:0 0 24px 4px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <img src="${LOGO_URL}" width="36" height="36" alt="Core Lens AI" style="display:block;width:36px;height:36px;border-radius:9px;" />
                    </td>
                    <td class="heading" style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#121212;">
                      Core Lens AI
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td class="card" style="background-color:#faf7ee;border:1px solid #e4dfd0;border-radius:16px;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <h1 class="heading" style="margin:0 0 16px 0;font-size:26px;line-height:34px;font-weight:600;letter-spacing:-0.02em;color:#121212;">${escapeHtml(heading)}</h1>
                ${paragraphHtml}

                <!-- Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td class="btn-cell" align="center" bgcolor="#121212" style="border-radius:10px;background-color:#121212;">
                      <!--[if mso]>
                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="20%" stroke="f" fillcolor="#121212">
                          <w:anchorlock xmlns:w="urn:schemas-microsoft-com:office:word"/>
                          <center style="color:#f4f0e5;font-family:Arial,sans-serif;font-size:16px;font-weight:600;">${escapeHtml(buttonLabel)}</center>
                        </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-->
                      <a class="btn-link" href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 32px;border:1px solid #121212;border-radius:10px;background-color:#121212;color:#f4f0e5;font-size:16px;font-weight:600;line-height:20px;text-decoration:none;">${escapeHtml(buttonLabel)}</a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>

                ${noteHtml}

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                  <tr>
                    <td class="divider" style="border-top:1px solid #e4dfd0;padding-top:20px;">
                      <p class="muted" style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:#5c5c52;">If the button doesn&rsquo;t work, copy and paste this link into your browser:</p>
                      <p class="muted" style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a class="link" href="${safeUrl}" style="color:#5c5c52;text-decoration:underline;">${safeUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:28px 16px 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p class="muted" style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#5c5c52;">
                  This email was sent to ${escapeHtml(recipient)} because of activity on your Core Lens AI account.
                </p>
                <p class="muted" style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#5c5c52;">
                  <a class="link" href="${SITE_URL}/terms" style="color:#5c5c52;text-decoration:underline;">Terms</a>
                  &nbsp;&middot;&nbsp;
                  <a class="link" href="${SITE_URL}/privacy-policy" style="color:#5c5c52;text-decoration:underline;">Privacy</a>
                  &nbsp;&middot;&nbsp;
                  <a class="link" href="mailto:${SUPPORT_EMAIL}" style="color:#5c5c52;text-decoration:underline;">Support</a>
                </p>
                <p class="muted" style="margin:0;font-size:12px;line-height:18px;color:#8a8a7d;">&copy; ${year} Core Lens AI</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    heading,
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    `${buttonLabel}: ${url}`,
    '',
    ...notes,
    '',
    '--',
    `Sent to ${recipient} by Core Lens AI`,
    `Terms: ${SITE_URL}/terms`,
    `Privacy: ${SITE_URL}/privacy-policy`,
    `Support: ${SUPPORT_EMAIL}`,
  ].join('\n');

  return { html, text };
}

const greeting = (name?: string | null) => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : 'Hi there,';
};

export async function sendVerificationEmail({ to, name, url }: { to: string; name?: string | null; url: string }) {
  const { html, text } = renderActionEmail({
    preheader: 'Confirm your email address to start using Core Lens AI.',
    heading: 'Confirm your email',
    paragraphs: [
      greeting(name),
      'Welcome to Core Lens AI. Confirm your email address to activate your account and start searching, reading and citing.',
    ],
    buttonLabel: 'Confirm email address',
    url,
    notes: [
      'This link expires in 1 hour and can only be used once.',
      "If you didn't create a Core Lens AI account, you can safely ignore this email.",
    ],
    recipient: to,
  });

  await sendEmail({ to, subject: 'Confirm your email for Core Lens AI', html, text });
}

export async function sendPasswordResetEmail({ to, name, url }: { to: string; name?: string | null; url: string }) {
  const { html, text } = renderActionEmail({
    preheader: 'Use this link to choose a new Core Lens AI password.',
    heading: 'Reset your password',
    paragraphs: [
      greeting(name),
      'We received a request to reset the password for your Core Lens AI account. Choose a new one using the button below.',
    ],
    buttonLabel: 'Reset password',
    url,
    notes: [
      'This link expires in 1 hour and can only be used once.',
      "If you didn't request this, you can safely ignore this email. Your password won't change.",
    ],
    recipient: to,
  });

  await sendEmail({ to, subject: 'Reset your Core Lens AI password', html, text });
}
