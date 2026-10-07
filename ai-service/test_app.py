"""Tests for the AI service. Run: python -m pytest"""

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def predict(**body):
    body.setdefault("location_in_unit", "")
    return client.post("/predict", json=body)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dangerous_request_is_high():
    r = predict(title="Socket sparks", description="The kitchen socket sparks and smells of burning", category="ELECTRICAL")
    assert r.status_code == 200
    assert r.json()["priority"] == "HIGH"


def test_cosmetic_request_is_low():
    r = predict(title="Paint peeling", description="The paint on the bedroom wall is peeling off", category="STRUCTURAL")
    assert r.json()["priority"] == "LOW"


def test_everyday_fault_is_medium():
    r = predict(title="Tap dripping", description="The kitchen tap keeps dripping even when closed", category="PLUMBING")
    assert r.json()["priority"] == "MEDIUM"


def test_response_shape():
    data = predict(title="Rats", description="Rats in the kitchen at night", category="PEST").json()
    assert set(data["probabilities"]) == {"HIGH", "MEDIUM", "LOW"}
    assert abs(sum(data["probabilities"].values()) - 1) < 0.01
    assert 0 <= data["confidence"] <= 1
    assert data["model_version"]


def test_safety_word_forces_high():
    # Unusual wording in a "low" category, but it mentions gas.
    data = predict(title="Small thing", description="I can smell gas near the doorbell wires", category="OTHER").json()
    assert data["priority"] == "HIGH"


def test_rejects_bad_input():
    assert predict(title="x", description="y", category="FOOD").status_code == 422
    assert client.post("/predict", json={"title": "only a title"}).status_code == 422
