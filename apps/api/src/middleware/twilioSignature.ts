import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../utils/logger";

/**
 * Twilio signs every webhook request with an X-Twilio-Signature header.
 * The signature is the base64-encoded HMAC-SHA1 of:
 *   - the full URL Twilio requested, followed by
 *   - each POST parameter, sorted alphabetically by key, as key+value with no separators,
 * keyed with the account's Auth Token.
 *
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function computeTwilioSignature(
    authToken: string,
    url: string,
    params: Record<string, unknown>
): string {
    const data = Object.keys(params)
        .sort()
        .reduce((acc, key) => acc + toFormUrlEncodedParam(key, params[key]), url);

    return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/**
 * Serializes a single parameter the way Twilio does when building the signed
 * payload: scalars become `name + value`; repeated keys (array values) are
 * de-duplicated, sorted, and concatenated. Mirrors Twilio's own SDK so the
 * reconstructed signature matches byte-for-byte.
 */
function toFormUrlEncodedParam(name: string, value: unknown): string {
    if (Array.isArray(value)) {
        return Array.from(new Set(value))
            .sort()
            .reduce((acc, val) => acc + toFormUrlEncodedParam(name, val), "");
    }
    return name + String(value);
}

/**
 * Constant-time comparison of two base64 signatures. Returns false on any
 * length mismatch so an attacker cannot learn the expected length via timing.
 */
export function signaturesMatch(expected: string, provided: string): boolean {
    const expectedBuf = Buffer.from(expected, "utf-8");
    const providedBuf = Buffer.from(provided, "utf-8");

    if (expectedBuf.length !== providedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Reconstructs the exact public URL Twilio used to reach this endpoint.
 *
 * When the API sits behind a proxy/load balancer that rewrites the host, set
 * TWILIO_WEBHOOK_PUBLIC_URL to the externally visible origin (e.g.
 * "https://api.sahidawa.in"); the request path and query string are appended
 * to it. Otherwise the URL is derived from the forwarded request (the app sets
 * "trust proxy", so req.protocol and req.host honour X-Forwarded-* headers).
 */
function buildRequestUrl(req: Request): string {
    const publicBase = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim();
    if (publicBase) {
        return `${publicBase.replace(/\/+$/, "")}${req.originalUrl}`;
    }
    return `${req.protocol}://${req.get("host")}${req.originalUrl}`;
}

/**
 * Express middleware that rejects any request to a Twilio webhook that does not
 * carry a valid X-Twilio-Signature. Must run after the body parser so the form
 * parameters are available for signature reconstruction.
 *
 * Fails closed: if TWILIO_AUTH_TOKEN is not configured the endpoint cannot
 * verify anything, so every request is rejected rather than silently trusted.
 */
export function verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
        logger.error(
            "Rejecting Twilio webhook request: TWILIO_AUTH_TOKEN is not configured, signatures cannot be verified."
        );
        res.status(403).send("Forbidden");
        return;
    }

    const signature = req.get("X-Twilio-Signature");
    if (!signature) {
        logger.warn("Rejecting Twilio webhook request: missing X-Twilio-Signature header.");
        res.status(403).send("Forbidden");
        return;
    }

    const url = buildRequestUrl(req);
    const params = (req.body ?? {}) as Record<string, unknown>;
    const expected = computeTwilioSignature(authToken, url, params);

    if (!signaturesMatch(expected, signature)) {
        logger.warn("Rejecting Twilio webhook request: invalid X-Twilio-Signature.", { url });
        res.status(403).send("Forbidden");
        return;
    }

    next();
}
