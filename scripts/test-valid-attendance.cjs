/**
 * ============================================================
 * Attendify Valid Attendance E2E Test
 * ============================================================
 *
 * PURPOSE:
 *   This script performs a real end-to-end attendance submission
 *   using a valid HMAC-SHA256 signature.
 *
 * FLOW:
 *   1. Request fresh nonce from production Worker.
 *   2. Build attendance payload.
 *   3. Canonicalize payload deterministically.
 *   4. Sign payload using APP_SECRET.
 *   5. Submit attendance request.
 *   6. Re-submit same request to verify replay protection.
 *
 * SECURITY NOTE:
 *   APP_SECRET is used here only for backend/security testing.
 *   Do not embed APP_SECRET inside Flutter/mobile production apps.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://attendify-worker.mahmouddamour-3aa.workers.dev";

/**
 * Lightweight .env loader.
 *
 * This avoids requiring dotenv for this test script.
 */
function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * Deterministic JSON canonicalization.
 *
 * The goal is to ensure both client and server sign the same
 * semantic payload representation regardless of object key order.
 *
 * Rules:
 *   - Primitive values use JSON.stringify.
 *   - Arrays preserve order.
 *   - Object keys are sorted lexicographically.
 */
function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

/**
 * HMAC-SHA256 signer.
 *
 * Output format:
 *   hex string
 */
function signPayload(payload, secret) {
  const canonicalPayload = canonicalize(payload);

  return crypto
    .createHmac("sha256", secret)
    .update(canonicalPayload)
    .digest("hex");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

async function main() {
  loadLocalEnv();

  const APP_SECRET = process.env.APP_SECRET;

  if (!APP_SECRET) {
    console.error("❌ APP_SECRET is missing.");
    console.error("");
    console.error("Set APP_SECRET using one of these options:");
    console.error("");
    console.error("PowerShell:");
    console.error('  $env:APP_SECRET = "PASTE_THE_SAME_APP_SECRET_FROM_RAILWAY"');
    console.error("");
    console.error("Or place it in local .env only:");
    console.error("  APP_SECRET=PASTE_THE_SAME_APP_SECRET_FROM_RAILWAY");
    process.exit(1);
  }

  console.log("============================================================");
  console.log("Attendify Valid Attendance E2E Test");
  console.log("============================================================");

  /**
   * Step 1: Get fresh nonce.
   */
  console.log("\n[1] Requesting fresh nonce...");

  const nonceResponse = await requestJson(`${BASE_URL}/nonce`);

  console.log("Nonce response status:", nonceResponse.status);
  console.log("Nonce response body:", nonceResponse.data);

  if (!nonceResponse.ok || !nonceResponse.data?.nonce) {
    throw new Error("Failed to obtain nonce.");
  }

  const nonce = nonceResponse.data.nonce;

  /**
   * Step 2: Build payload.
   */
  const payload = {
    userId: "employee-123",
    timestamp: Date.now(),
    location: {
      lat: 25.2048,
      lng: 55.2708
    },
    nonce: {
      value: nonce.value,
      issuedAt: nonce.issuedAt,
      expiresAt: nonce.expiresAt
    }
  };

  /**
   * Step 3: Sign payload.
   */
  const signature = signPayload(payload, APP_SECRET);

  const body = {
    payload,
    signature
  };

  console.log("\n[2] Canonical payload:");
  console.log(canonicalize(payload));

  console.log("\n[3] Generated HMAC signature:");
  console.log(signature);

  /**
   * Step 4: Submit valid attendance.
   */
  console.log("\n[4] Submitting valid attendance request...");

  const attendanceResponse = await requestJson(`${BASE_URL}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  console.log("Attendance response status:", attendanceResponse.status);
  console.log("Attendance response body:", attendanceResponse.data);

  /**
   * Step 5: If success, test replay protection.
   */
  console.log("\n[5] Re-sending same request to verify replay protection...");

  const replayResponse = await requestJson(`${BASE_URL}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  console.log("Replay response status:", replayResponse.status);
  console.log("Replay response body:", replayResponse.data);

  console.log("\n============================================================");
  console.log("Test completed.");
  console.log("============================================================");
}

main().catch((error) => {
  console.error("\n❌ Test failed:");
  console.error(error);
  process.exit(1);
});