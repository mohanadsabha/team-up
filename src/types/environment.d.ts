declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    PORT: string;
    NODE_ENV: "development" | "production" | "test";
    JWT_SECRET: string;
    JWT_TTL: string;
    EMAIL: string;
    PASSWORD: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    EMAIL_HOST: string;
    EMAIL_PORT: string;
    EMAIL_USERNAME: string;
    EMAIL_PASSWORD: string;
    FRONTEND_URL: string;
    FRONTEND_URL_WWW: string;
    SERVER_MODE?: "api" | "worker" | "all";
    MEETING_REMINDER_INTERVAL_MS?: string;
    PAYMENT_AUTO_CONFIRM?: "true" | "false";
    RENDER_EXTERNAL_URL?: string;
    API_PUBLIC_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    LINKEDIN_REDIRECT_URI?: string;
  }
}
