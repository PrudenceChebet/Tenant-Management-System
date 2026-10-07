# AI priority service (step 4)

A small Python service that reads a maintenance request and recommends a priority: **High**, **Medium** or **Low**. The Node API calls it for every new request. If it is off or slow, the API uses keyword rules instead, so the app keeps working.

## How it works

1. **Data** (`data/generate_dataset.py` → `data/requests.csv`): 1,586 labelled tenant requests written from 61 problem scenarios. There is no public dataset of Kenyan tenant maintenance requests, so the data is synthetic and follows a written labelling guide (at the top of the script).
2. **Features**: TF-IDF on the words and two-word phrases ("burst pipe", "no water"), TF-IDF on character pieces (so typos still match), and the category the tenant picked.
3. **Models compared**: Logistic Regression, Complement Naive Bayes, Random Forest, plus the keyword rules and "always Medium" as baselines.
4. **Testing**: the test set uses sentence wordings that never appear in training. A second stress test leaves out whole problem types.
5. **Deployed model**: Complement Naive Bayes with a safety net. Any danger word (fire, gas, sparks, burst, sewage, no water…) always gives High, because missing an emergency costs far more than over-prioritising one request.

## Results

Full tables are in `results/report.md`. On wordings never seen in training:

| Method | Macro F1 | Catches High requests |
|---|---|---|
| **Deployed model (Naive Bayes + safety words)** | **0.83** | **94%** |
| Naive Bayes alone | 0.86 | 94% |
| Logistic Regression | 0.79 | 91% |
| Random Forest | 0.69 | 64% |
| Keyword rules only | 0.57 | 84% |

On problem types the model has never seen at all, Naive Bayes alone catches only 32% of High requests; with the safety words it catches 97%. That is why the safety net stays on.

Charts for the report: `results/confusion_matrix.png` and `results/model_comparison.png`.

## Setting it up on Windows (first time)

1. Install **Python 3.12 or newer** from https://www.python.org/downloads/. On the first installer screen, **tick "Add python.exe to PATH"**, then click Install Now.
2. Close VS Code completely and open it again (so the terminal sees Python).
3. Open a new terminal in VS Code and run:

```
cd ai-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python train.py
```

The last command trains the model (about 20 seconds) and saves `model/model.joblib`, plus the charts and `results/report.md`.

## Running it (every time)

```
cd ai-service
.venv\Scripts\python -m uvicorn app:app --port 8000
```

Leave the terminal open. Check it at http://localhost:8000/health. You can also try predictions in the browser at **http://localhost:8000/docs** → `POST /predict` → **Try it out**.

With all three running (server, client, ai-service), new requests in the app show "Recommended by AI (xx% confident)" instead of "Set by keyword rules".

## Tests

```
.venv\Scripts\python -m pytest
```

## Retraining

Run `python data/generate_dataset.py` (only if you changed the scenarios), then `python train.py`, then restart the service. Landlord priority overrides are saved in the `PriorityOverride` table. Exporting them into `data/requests.csv` and retraining is how the model improves with real use.
