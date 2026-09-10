const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  requireAdminRequest,
  isPublicTrackingRequest,
  requireTrackingOrigin,
  requireSameOriginMutation,
} = require("@/lib/server/access");

function withEnv(overrides, fn) {
  const original = {};
  for (const key of Object.keys(overrides)) original[key] = process.env[key];
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

function basicAuthHeader(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

test("requireAdminRequest blocks writes in production when no admin password is configured", () => {
  withEnv({ ADS_ADMIN_PASSWORD: "", NODE_ENV: "production" }, () => {
    const req = new Request("https://ads.example.com/api/campaigns", { method: "POST" });
    const res = requireAdminRequest(req);
    assert.ok(res instanceof Response);
    assert.equal(res.status, 503);
  });
});

test("requireAdminRequest allows localhost in development when no admin password is configured", () => {
  withEnv({ ADS_ADMIN_PASSWORD: "", NODE_ENV: "development" }, () => {
    const req = new Request("http://localhost:3000/api/campaigns", { method: "POST" });
    const res = requireAdminRequest(req);
    assert.equal(res, null);
  });
});

test("requireAdminRequest rejects requests with no Authorization header once a password is set", () => {
  withEnv({ ADS_ADMIN_PASSWORD: "secret", NODE_ENV: "production" }, () => {
    const req = new Request("https://ads.example.com/api/campaigns", { method: "POST" });
    const res = requireAdminRequest(req);
    assert.ok(res instanceof Response);
    assert.equal(res.status, 401);
  });
});

test("requireAdminRequest rejects an incorrect password", () => {
  withEnv({ ADS_ADMIN_PASSWORD: "secret", NODE_ENV: "production" }, () => {
    const req = new Request("https://ads.example.com/api/campaigns", {
      method: "POST",
      headers: { authorization: basicAuthHeader("admin", "wrong-password") },
    });
    const res = requireAdminRequest(req);
    assert.ok(res instanceof Response);
    assert.equal(res.status, 401);
  });
});

test("requireAdminRequest allows the correct username and password", () => {
  withEnv({ ADS_ADMIN_PASSWORD: "secret", ADS_ADMIN_USERNAME: "ops", NODE_ENV: "production" }, () => {
    const req = new Request("https://ads.example.com/api/campaigns", {
      method: "POST",
      headers: { authorization: basicAuthHeader("ops", "secret") },
    });
    const res = requireAdminRequest(req);
    assert.equal(res, null);
  });
});

test("isPublicTrackingRequest only matches the documented tracking endpoints and methods", () => {
  assert.equal(isPublicTrackingRequest("/api/tracking/events", "POST"), true);
  assert.equal(isPublicTrackingRequest("/api/tracking/rules", "GET"), true);
  assert.equal(isPublicTrackingRequest("/api/campaigns", "POST"), false);
  assert.equal(isPublicTrackingRequest("/api/tracking/events", "DELETE"), false);
});

test("requireTrackingOrigin allows same-origin requests", () => {
  const req = new Request("https://ads.example.com/api/tracking/events", {
    method: "POST",
    headers: { origin: "https://ads.example.com" },
  });
  assert.equal(requireTrackingOrigin(req), null);
});

test("requireTrackingOrigin blocks an origin that is not on the allowlist", () => {
  withEnv({ ADS_TRACKING_ORIGINS: "https://allowed.example.com" }, () => {
    const req = new Request("https://ads.example.com/api/tracking/events", {
      method: "POST",
      headers: { origin: "https://attacker.example.com" },
    });
    const res = requireTrackingOrigin(req);
    assert.ok(res instanceof Response);
    assert.equal(res.status, 403);
  });
});

test("requireTrackingOrigin allows an origin explicitly present in the allowlist", () => {
  withEnv({ ADS_TRACKING_ORIGINS: "https://allowed.example.com" }, () => {
    const req = new Request("https://ads.example.com/api/tracking/events", {
      method: "POST",
      headers: { origin: "https://allowed.example.com" },
    });
    assert.equal(requireTrackingOrigin(req), null);
  });
});

test("requireSameOriginMutation allows GET requests regardless of origin", () => {
  const req = new Request("https://ads.example.com/api/campaigns", {
    method: "GET",
    headers: { origin: "https://attacker.example.com" },
  });
  assert.equal(requireSameOriginMutation(req), null);
});

test("requireSameOriginMutation blocks a cross-site mutation", () => {
  const req = new Request("https://ads.example.com/api/campaigns", {
    method: "POST",
    headers: { origin: "https://attacker.example.com", "sec-fetch-site": "cross-site" },
  });
  const res = requireSameOriginMutation(req);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 403);
});

test("requireSameOriginMutation allows a same-origin mutation", () => {
  const req = new Request("https://ads.example.com/api/campaigns", {
    method: "POST",
    headers: { origin: "https://ads.example.com" },
  });
  assert.equal(requireSameOriginMutation(req), null);
});
