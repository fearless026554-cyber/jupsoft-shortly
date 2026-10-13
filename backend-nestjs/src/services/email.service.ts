import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env.js';

export interface UserCredentialsEmailParams {
  toEmail: string;
  toName: string;
  role: string;
  tempPassword: string;
  portalUrl?: string;
  isPasswordReset?: boolean;
}

export interface PasswordResetLinkEmailParams {
  toEmail: string;
  toName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sesClient: SESClient | null = null;
  private readonly fromEmail: string;

  constructor() {
    this.fromEmail = env.SES_FROM_EMAIL || 'do_not_reply@jupsoft.com';

    if (env.AWS_SES_ACCESS_KEY_ID && env.AWS_SES_SECRET_ACCESS_KEY) {
      this.sesClient = new SESClient({
        region: env.AWS_SES_REGION || 'ap-south-1',
        credentials: {
          accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
        },
      });
      this.logger.log(`SES Transactional Email Service initialized (Region: ${env.AWS_SES_REGION || 'ap-south-1'}, Sender: ${this.fromEmail})`);
    } else {
      this.logger.warn('AWS SES credentials not configured. Transactional emails will be simulated to console log.');
    }
  }

  /**
   * Send account credentials to a newly invited/created user or upon admin password reset
   */
  async sendUserCredentialsEmail(params: UserCredentialsEmailParams): Promise<boolean> {
    const { toEmail, toName, role, tempPassword, isPasswordReset = false } = params;
    const portalUrl = params.portalUrl || env.FRONTEND_URL || 'https://go.jupsoft.com';
    const formattedRole = role ? role.replace(/_/g, ' ').toUpperCase() : 'USER';

    const subject = isPasswordReset
      ? 'Security Notice: Your Jupsoft Shortly Password Has Been Reset'
      : 'Welcome to Jupsoft Shortly — Your Account Credentials';

    const actionText = isPasswordReset
      ? 'Your account password has been reset by an administrator. Below are your updated access credentials:'
      : 'Your account on the Jupsoft Shortly Enterprise Link Platform has been successfully created. You can now access the portal with the following credentials:';

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid #334155; }
    .brand-title { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.5px; }
    .brand-subtitle { color: #94a3b8; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .cred-box { background-color: #0f172a; border: 1px solid #475569; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .cred-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { color: #94a3b8; font-weight: 500; }
    .cred-value { color: #ffffff; font-weight: 600; font-family: 'Courier New', Courier, monospace; }
    .cred-role { background-color: #2563eb; color: #ffffff; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 700; display: inline-block; }
    .btn-container { text-align: center; margin: 32px 0 20px; }
    .btn { background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
    .btn:hover { background-color: #1d4ed8; }
    .warning { background-color: #451a03; border: 1px solid #92400e; border-radius: 8px; padding: 14px 16px; font-size: 12px; color: #fed7aa; margin-top: 20px; line-height: 1.5; }
    .footer { text-align: center; padding: 24px 20px; font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 class="brand-title">Jupsoft Shortly</h1>
        <div class="brand-subtitle">Enterprise Link Management Platform</div>
      </div>
      <div class="content">
        <div class="greeting">Hello ${escapeHtml(toName)},</div>
        <p class="desc">${actionText}</p>

        <div class="cred-box">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 500; width: 40%;">Sign-in Email</td>
              <td style="padding: 8px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right;">${escapeHtml(toEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 500; border-top: 1px solid #1e293b;">Temporary Password</td>
              <td style="padding: 8px 0; color: #38bdf8; font-size: 14px; font-weight: 700; font-family: monospace; text-align: right; border-top: 1px solid #1e293b; letter-spacing: 0.5px;">${escapeHtml(tempPassword)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 500; border-top: 1px solid #1e293b;">Assigned Role</td>
              <td style="padding: 8px 0; text-align: right; border-top: 1px solid #1e293b;">
                <span class="cred-role">${escapeHtml(formattedRole)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 500; border-top: 1px solid #1e293b;">Portal URL</td>
              <td style="padding: 8px 0; color: #93c5fd; font-size: 13px; font-weight: 500; text-align: right; border-top: 1px solid #1e293b;">${escapeHtml(portalUrl)}</td>
            </tr>
          </table>
        </div>

        <div class="btn-container">
          <a href="${escapeHtml(portalUrl)}" class="btn" target="_blank" rel="noopener">Sign In to Jupsoft Shortly</a>
        </div>

        <div class="warning">
          <strong>Security Notice:</strong> For enterprise security compliance, please sign in and change your temporary password immediately in your account settings. Never share this password with anyone.
        </div>
      </div>
      <div class="footer">
        This is an automated system email sent from Jupsoft Shortly Platform.<br>
        &copy; ${new Date().getFullYear()} Jupsoft Technologies. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Jupsoft Shortly - Enterprise Link Platform
=========================================

Hello ${toName},

${actionText}

Your Login Credentials:
-----------------------
- Email: ${toEmail}
- Temporary Password: ${tempPassword}
- Assigned Role: ${formattedRole}
- Portal URL: ${portalUrl}

Please sign in and change your password immediately:
${portalUrl}

Security Notice: Never share this password with anyone.

(C) ${new Date().getFullYear()} Jupsoft Technologies.
    `.trim();

    return this.sendMail({
      to: toEmail,
      subject,
      html: htmlBody,
      text: textBody,
    });
  }

  /**
   * Send a secure single-use Password Reset Link
   */
  async sendPasswordResetLinkEmail(params: PasswordResetLinkEmailParams): Promise<boolean> {
    const { toEmail, toName, resetUrl, expiresInMinutes = 15 } = params;
    const subject = 'Password Reset Request — Jupsoft Shortly';

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid #334155; }
    .brand-title { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.5px; }
    .brand-subtitle { color: #94a3b8; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 32px 0 24px; }
    .btn { background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
    .btn:hover { background-color: #1d4ed8; }
    .fallback-link { background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px; font-size: 12px; word-break: break-all; color: #93c5fd; margin-top: 20px; }
    .notice { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
    .footer { text-align: center; padding: 24px 20px; font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 class="brand-title">Jupsoft Shortly</h1>
        <div class="brand-subtitle">Enterprise Link Management Platform</div>
      </div>
      <div class="content">
        <div class="greeting">Hello ${escapeHtml(toName)},</div>
        <p class="desc">
          We received a request to reset the password for your Jupsoft Shortly account. Click the button below to choose a new secure password:
        </p>

        <div class="btn-container">
          <a href="${escapeHtml(resetUrl)}" class="btn" target="_blank" rel="noopener">Reset Password</a>
        </div>

        <p class="desc" style="font-size: 13px; color: #94a3b8;">
          If the button above does not work, copy and paste this link into your web browser:
        </p>
        <div class="fallback-link">
          <a href="${escapeHtml(resetUrl)}" style="color: #60a5fa; text-decoration: none;">${escapeHtml(resetUrl)}</a>
        </div>

        <div class="notice">
          <strong>Important:</strong> This password reset link is valid for <strong>${expiresInMinutes} minutes</strong> and can only be used once.<br>
          If you did not make this request, please disregard this email. Your password will remain unchanged.
        </div>
      </div>
      <div class="footer">
        This is an automated security email from Jupsoft Shortly.<br>
        &copy; ${new Date().getFullYear()} Jupsoft Technologies. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Jupsoft Shortly - Password Reset Request
=======================================

Hello ${toName},

We received a request to reset the password for your Jupsoft Shortly account.

Click or copy the following link to reset your password:
${resetUrl}

This link is valid for ${expiresInMinutes} minutes and can only be used once.

If you did not request a password reset, please ignore this email. Your account remains secure.

(C) ${new Date().getFullYear()} Jupsoft Technologies.
    `.trim();

    return this.sendMail({
      to: toEmail,
      subject,
      html: htmlBody,
      text: textBody,
    });
  }

  /**
   * Internal sender method using AWS SES or simulated fallback
   */
  private async sendMail(options: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
    if (!this.sesClient) {
      this.logger.warn(`[SES SIMULATED] Would send email to ${options.to} with subject "${options.subject}"`);
      return true;
    }

    try {
      const command = new SendEmailCommand({
        Source: `"Jupsoft Shortly" <${this.fromEmail}>`,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: options.text,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const response = await this.sesClient.send(command);
      this.logger.log(`Email successfully delivered to ${options.to} (MessageId: ${response.MessageId})`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to deliver email to ${options.to} via AWS SES: ${err.message}`, err.stack);
      return false;
    }
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
