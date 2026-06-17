import Stripe from "stripe";
import AppError from "./appError";

type StripeClient = InstanceType<typeof Stripe>;

let stripeClient: StripeClient | null = null;

export const getStripeClient = (): StripeClient => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secretKey)) {
    throw new AppError(
      "Stripe secret key is invalid. Use a real sk_test_... or sk_live_... value in STRIPE_SECRET_KEY.",
      500,
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
};
