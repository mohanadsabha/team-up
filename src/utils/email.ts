import nodemailer from "nodemailer";
import pug from "pug";
import { convert } from "html-to-text";
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

  private createTransporter() {
    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USERNAME ||
      !process.env.EMAIL_PASSWORD
    ) {
      console.error(
        "Missing email environment variables. Please check EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD.",
      );
    }
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: process.env.EMAIL_PORT === "465",
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(
    template: string,
    subject: string,
    templateData?: Record<string, any>,
  ) {
    const html = pug.renderFile(
      path.join(__dirname, `../templates/${template}.pug`),
      {
        name: this.name || "",
        email: this.from,
        subject,
        ...templateData,
      },
    );

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html, {
        wordwrap: 130,
      }),
    };

    await this.createTransporter().sendMail(mailOptions);
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
