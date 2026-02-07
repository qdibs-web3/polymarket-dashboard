import sgMail from '@sendgrid/mail';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@predictiveapex.club';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';

if (EMAIL_PROVIDER === 'sendgrid' && SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, html, text } = options;
  
  if (EMAIL_PROVIDER === 'console') {
    console.log('\n=== EMAIL (Console Mode) ===');
    console.log(`To: ${to}`);
    console.log(`From: ${FROM_EMAIL}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text || 'N/A'}`);
    console.log(`HTML: ${html}`);
    console.log('============================\n');
    return;
  }
  
  if (EMAIL_PROVIDER === 'sendgrid') {
    try {
      await sgMail.send({
        to,
        from: FROM_EMAIL,
        subject,
        html,
        text: text || '',
      });
      console.log(`Email sent to ${to} via SendGrid`);
    } catch (error) {
      console.error('SendGrid error:', error);
      throw new Error('Failed to send email via SendGrid');
    }
    return;
  }
  
  throw new Error(`Unsupported email provider: ${EMAIL_PROVIDER}`);
}

export function buildMagicLinkEmail(magicLinkUrl: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in to Predictive Apex</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px;">
                  <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #111827;">
                    Sign in to Predictive Apex
                  </h1>
                  <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                    Click the button below to sign in to your account. This link will expire in 15 minutes.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 16px 0;">
                        <a href="${magicLinkUrl}" style="display: inline-block; padding: 12px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                          Sign In
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                    If you didn't request this email, you can safely ignore it.
                  </p>
                  <p style="margin: 16px 0 0 0; font-size: 12px; line-height: 18px; color: #9ca3af;">
                    Or copy and paste this URL into your browser:  

                    <a href="${magicLinkUrl}" style="color: #3b82f6; word-break: break-all;">${magicLinkUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; font-size: 12px; line-height: 18px; color: #6b7280; text-align: center;">
                    © 2025 Predictive Apex. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const text = `
Sign in to Predictive Apex

Click the link below to sign in to your account. This link will expire in 15 minutes.

${magicLinkUrl}

If you didn't request this email, you can safely ignore it.
  `.trim();
  
  return { html, text };
}
