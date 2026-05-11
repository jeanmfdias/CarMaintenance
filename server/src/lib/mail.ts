import nodemailer, { type Transporter } from 'nodemailer'
import { config } from '../config.js'

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (transporter) return transporter
  if (!config.smtp.host) return null
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth:
      config.smtp.user && config.smtp.pass
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
  })
  return transporter
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const t = getTransporter()
  if (!t) {
    // Dev fallback: log to console
    console.log(`[mail] (no SMTP configured) magic link for ${email}: ${link}`)
    return
  }
  await t.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Your CarMaintenance sign-in link',
    text: `Sign in to CarMaintenance:\n\n${link}\n\nThe link expires in ${config.magicLinkTtlMin} minutes.`,
    html: `
      <p>Sign in to <strong>CarMaintenance</strong>:</p>
      <p><a href="${link}">${link}</a></p>
      <p>The link expires in ${config.magicLinkTtlMin} minutes. If you didn't request this, you can ignore this message.</p>
    `,
  })
}
