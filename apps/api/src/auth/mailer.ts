import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '@elsa3d/config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export function createMailer(config: AppConfig): Mailer {
  if (config.MAIL_TRANSPORT === 'console') {
    return {
      async send(message) {
        console.info('[mail:console]', JSON.stringify(message));
      },
    };
  }

  const auth =
    config.SMTP_USER && config.SMTP_PASSWORD
      ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
      : undefined;
  const transporter: Transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    requireTLS: Boolean(auth),
    disableFileAccess: true,
    disableUrlAccess: true,
    ...(auth ? { auth } : {}),
  });

  return {
    async send(message) {
      await transporter.sendMail({ from: config.MAIL_FROM, ...message });
    },
  };
}
