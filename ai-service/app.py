"""
AI priority service.

The Node API sends every new maintenance request here and gets back a
recommended priority. If this service is down or slow, the Node API falls
back to keyword rules, so tenants are never blocked.

Run:  python -m uvicorn app:app --port 8000
Docs: http://localhost:8000/docs  (try /predict from the browser)
"""

from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from priority_rules import has_safety_keyword

MODEL_PATH = Path(__file__).parent / "model" / "model.joblib"

Category = Literal["PLUMBING", "ELECTRICAL", "STRUCTURAL", "SECURITY", "APPLIANCE", "PEST", "OTHER"]
Priority = Literal["HIGH", "MEDIUM", "LOW"]


class PredictRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120, examples=["Kitchen sink pipe burst"])
    description: str = Field(min_length=1, max_length=2000, examples=["Water is flooding the kitchen floor"])
    category: Category = Field(examples=["PLUMBING"])
    location_in_unit: str = Field(default="", max_length=60, examples=["kitchen"])


class PredictResponse(BaseModel):
    priority: Priority
    confidence: float = Field(description="How sure the model is about the returned priority, 0 to 1")
    probabilities: dict[str, float]
    safety_override: bool = Field(description="True when a safety word forced HIGH over the model's choice")
    model_version: str


def load_model():
    if not MODEL_PATH.exists():
        raise RuntimeError("model/model.joblib not found. Run `python train.py` first.")
    return joblib.load(MODEL_PATH)


bundle = load_model()
pipeline = bundle["pipeline"]
app = FastAPI(title="TMS AI priority service", version=bundle["version"])


@app.get("/health")
def health():
    return {"status": "ok", "model": bundle["model_name"], "model_version": bundle["version"]}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    text = f"{req.title}. {req.description}. {req.location_in_unit}".lower()
    X = pd.DataFrame({"text": [text], "category": [req.category]})
    try:
        probs = pipeline.predict_proba(X)[0]
    except Exception as err:  # should not happen, but never crash the caller
        raise HTTPException(status_code=500, detail=f"Prediction failed: {err}")

    by_label = {label: round(float(p), 3) for label, p in zip(pipeline.classes_, probs)}
    model_choice = max(by_label, key=by_label.get)

    # Safety net: a danger word always means HIGH, even if the model disagrees.
    # Missing a real emergency costs far more than over-prioritising one request.
    override = model_choice != "HIGH" and has_safety_keyword(req.title, req.description)
    priority = "HIGH" if override else model_choice

    return PredictResponse(
        priority=priority,
        confidence=by_label[priority],
        probabilities=by_label,
        safety_override=override,
        model_version=bundle["version"],
    )
