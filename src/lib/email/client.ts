import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ClientEmailConfig {
  fromName: string;
  fromAddress: string;
  replyTo: string;
  bcc?: string;
  domain: string;
}

interface SendEmailParams {
  clientId: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  attachments?: { filename: string; content: Buffer | string }[];
  replyToOverride?: string;
}

const FORBIDDEN_DOMAINS = /xlumenx\.com|xwrenx\.com/i;

function loadClientEmailConfig(clientId: string): ClientEmailConfig {
  const configPath = path.join(process.cwd(), 'clients', clientId, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`CLIENT_NOT_FOUND: No config for client "${clientId}"`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  const emailConfig = config.email as ClientEmailConfig | undefined;
  if (!emailConfig?.fromAddress) {
    throw new Error(`MISSING_EMAIL_CONFIG: Client "${clientId}" has no email config in config.json`);
  }
  if (FORBIDDEN_DOMAINS.test(emailConfig.fromAddress) || FORBIDDEN_DOMAINS.test(emailConfig.replyTo ?? '')) {
    throw new Error(`FORBIDDEN_SENDER: Client "${clientId}" config contains xlumenx/xwrenx address`);
  }
  return emailConfig;
}

export async function sendClientEmail(params: SendEmailParams) {
  const cfg = loadClientEmailConfig(params.clientId);
  const from = `${cfg.fromName} <${cfg.fromAddress}>`;
  const replyTo = params.replyToOverride ?? cfg.replyTo;

  if (FORBIDDEN_DOMAINS.test(from) || FORBIDDEN_DOMAINS.test(replyTo)) {
    throw new Error('FORBIDDEN_SENDER_RUNTIME: xlumenx/xwrenx detected at send time');
  }

  return resend.emails.send({
    from,
    to: params.to,
    replyTo,
    bcc: cfg.bcc,
    cc: params.cc,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments,
  });
}
