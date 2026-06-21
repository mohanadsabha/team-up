import { Request } from "express";

const DEFAULT_FRONTEND_URL = "http://localhost:3000";
const PRODUCTION_FRONTEND_URL = "https://team-up-website-front.vercel.app";

type OAuthStatePayload = {
  returnUrl: string;
};

const normalizeOrigin = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
};

const getAllowedFrontendOrigins = () => {
  const origins = new Set<string>();

  for (const value of [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_WWW,
    PRODUCTION_FRONTEND_URL,
    DEFAULT_FRONTEND_URL,
  ]) {
    if (value?.trim()) {
      origins.add(normalizeOrigin(value));
    }
  }

  return origins;
};

const isAllowedFrontendOrigin = (value: string) => {
  const normalized = normalizeOrigin(value);
  return normalized.length > 0 && getAllowedFrontendOrigins().has(normalized);
};

export const encodeOAuthState = (returnUrl: string) => {
  const payload: OAuthStatePayload = { returnUrl: normalizeOrigin(returnUrl) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

export const decodeOAuthState = (state: unknown) => {
  if (typeof state !== "string" || !state.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as OAuthStatePayload;

    if (typeof parsed.returnUrl !== "string") {
      return undefined;
    }

    return normalizeOrigin(parsed.returnUrl);
  } catch {
    return undefined;
  }
};

export const resolveOAuthReturnUrl = (
  req: Request,
  stateReturnUrl?: string,
) => {
  const refererOrigin = (() => {
    const referer = req.headers.referer;
    if (!referer) {
      return undefined;
    }

    try {
      return normalizeOrigin(new URL(referer).origin);
    } catch {
      return undefined;
    }
  })();

  const candidates = [
    stateReturnUrl,
    typeof req.query.returnUrl === "string" ? req.query.returnUrl : undefined,
    req.headers.origin,
    refererOrigin,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_WWW,
    PRODUCTION_FRONTEND_URL,
  ];

  for (const candidate of candidates) {
    if (candidate && isAllowedFrontendOrigin(candidate)) {
      return normalizeOrigin(candidate);
    }
  }

  return normalizeOrigin(
    process.env.FRONTEND_URL ??
      process.env.FRONTEND_URL_WWW ??
      PRODUCTION_FRONTEND_URL,
  );
};
