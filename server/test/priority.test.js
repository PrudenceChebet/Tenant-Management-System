// Unit tests for the priority decision (no database needed).
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { rulePriority, decidePriority } from "../src/services/priority.js";

const sample = {
  title: "Pipe burst under sink",
  description: "Water is flooding the kitchen floor",
  category: "PLUMBING",
};

// Starts a fake AI service on a random port.
function fakeAi(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler).listen(0, () => {
      resolve({ server, url: `http://localhost:${server.address().port}` });
    });
  });
}

test("rules: danger words give HIGH", () => {
  assert.equal(rulePriority(sample), "HIGH");
  assert.equal(rulePriority({ title: "Socket sparks", description: "sparks when plugging in", category: "ELECTRICAL" }), "HIGH");
});

test("rules: ordinary faults give MEDIUM, cosmetic ones LOW", () => {
  assert.equal(rulePriority({ title: "Tap dripping", description: "the bathroom tap drips all night", category: "PLUMBING" }), "MEDIUM");
  assert.equal(rulePriority({ title: "Paint peeling", description: "paint peeling off the bedroom wall", category: "OTHER" }), "LOW");
});

test("uses the AI service when it answers", async () => {
  const { server, url } = await fakeAi((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ priority: "MEDIUM", confidence: 0.72 }));
  });
  process.env.AI_SERVICE_URL = url;
  const result = await decidePriority(sample);
  server.close();
  assert.deepEqual(result, { priority: "MEDIUM", prioritySource: "AI", aiPriority: "MEDIUM", aiConfidence: 0.72 });
});

test("falls back to rules when the AI service is down", async () => {
  process.env.AI_SERVICE_URL = "http://localhost:1"; // nothing listens here
  const result = await decidePriority(sample);
  assert.equal(result.prioritySource, "RULE");
  assert.equal(result.priority, "HIGH");
  assert.equal(result.aiPriority, null);
});

test("falls back to rules when the AI service is too slow (over 3 s)", async () => {
  const { server, url } = await fakeAi((req, res) => {
    setTimeout(() => res.end(JSON.stringify({ priority: "LOW", confidence: 0.9 })), 5000);
  });
  process.env.AI_SERVICE_URL = url;
  const started = Date.now();
  const result = await decidePriority(sample);
  server.closeAllConnections();
  server.close();
  assert.equal(result.prioritySource, "RULE");
  assert.ok(Date.now() - started < 4000, "should give up after about 3 seconds");
});

test("falls back to rules when the AI service returns nonsense", async () => {
  const { server, url } = await fakeAi((req, res) => res.end(JSON.stringify({ priority: "URGENT!!" })));
  process.env.AI_SERVICE_URL = url;
  const result = await decidePriority(sample);
  server.close();
  assert.equal(result.prioritySource, "RULE");
});
