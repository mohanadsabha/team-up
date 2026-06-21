import nodemailer from "nodemailer";
import pug from "pug";
import { convert } from "html-to-text";
import fs from "fs";
import path from "path";

interface ContactFormData {
  name: string;
  email: string;
  phone?: string | undefined;
  company: string;
  service: string;
  message: string;
}

interface ResetPasswordEmailData {
  to: string;
  name: string;
  resetUrl: string;
}

interface VerifyEmailData {
  to: string;
  name: string;
  verificationUrl: string;
}

class Email {
  private from?: string;
  private to?: string;
  private name?: string;
  private transporter: nodemailer.Transporter | null = null;

  private resolveTemplatePath(template: string) {
    const candidates = [
      path.join(__dirname, `../templates/${template}.pug`),
      path.join(process.cwd(), "src/templates", `${template}.pug`),
      path.join(process.cwd(), "dist/templates", `${template}.pug`),
    ];

    const templatePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!templatePath) {
      throw new Error(`Email template not found: ${template}.pug`);
    }

    return templatePath;
  }

  private createTransporter() {
    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USERNAME ||
      !process.env.EMAIL_PASSWORD ||
      !process.env.EMAIL
    ) {
      throw new Error(
        "Missing email configuration. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, and EMAIL.",
      );
    }

    const port = parseInt(process.env.EMAIL_PORT ?? "587", 10);

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 12_000,
    });
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = this.createTransporter();
    }

    return this.transporter;
  }

  async send(
    template: string,
    subject: string,
    templateData?: Record<string, any>,
  ) {
    const html = pug.renderFile(this.resolveTemplatePath(template), {
      name: this.name || "",
      email: this.from,
      subject,
      ...templateData,
    });

    const info = await this.getTransporter().sendMail({
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html, {
        wordwrap: 130,
      }),
    });

    console.log(
      `Email "${subject}" accepted for ${this.to} (${info.messageId ?? "no-id"})`,
    );
  }

  async sendContactToAdmin(contactData: ContactFormData) {
    this.from = `"${contactData.name}" <${contactData.email}>`;
    this.to = process.env.EMAIL;
    this.name = contactData.name;
    await this.send(
      "contactForm",
      `New Contact Form Submission from ${contactData.name}`,
      {
        contact: contactData,
      },
    );
  }

  async sendPasswordReset(data: ResetPasswordEmailData) {
    this.from = process.env.EMAIL;
    this.to = data.to;
    this.name = data.name;
    await this.send("resetPassword", "Reset your password", {
      resetUrl: data.resetUrl,
    });
  }

  async sendEmailVerification(data: VerifyEmailData) {
    this.from = process.env.EMAIL;
    this.to = data.to;
    this.name = data.name;
    await this.send("verifyEmail", "Verify your email address", {
      verificationUrl: data.verificationUrl,
    });
  }
}

export const emailService = new Email();
