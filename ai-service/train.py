"""
Trains and evaluates the maintenance-request priority model.

What it does
1. Loads data/requests.csv (title, description, category, location, priority).
2. Holds out 20% of the SCENARIOS as a test set, so the model is tested on
   kinds of problems and wordings it never saw in training. This is stricter
   (and more honest) than a random split, where near-identical sentences end
   up in both training and test.
3. Compares three models with 5-fold cross-validation on the training part:
   Logistic Regression, Complement Naive Bayes and Random Forest.
4. Compares the best model with two simple baselines on the test set:
   the keyword rules the API falls back on, and "everything is MEDIUM".
5. Retrains the best model on ALL the data and saves it to model/model.joblib.

Run:  python train.py
Out:  model/model.joblib, results/metrics.json, results/*.png, results/report.md
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedGroupKFold, cross_validate
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from priority_rules import has_safety_keyword, rule_priority

ROOT = Path(__file__).parent
LABELS = ["HIGH", "MEDIUM", "LOW"]
SEED = 42


def combine_text(df):
    """The text the model reads: title + description + location."""
    return (df["title"].fillna("") + ". " + df["description"].fillna("") + ". " + df["location_in_unit"].fillna("")).str.lower()


def prepare(df):
    out = pd.DataFrame({"text": combine_text(df), "category": df["category"]})
    return out


def build_pipeline(model):
    features = ColumnTransformer(
        [
            # Words and two-word phrases ("burst pipe", "no water").
            ("words", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True), "text"),
            # Character pieces, so typos and word endings still match ("sparkin", "leakin").
            ("chars", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, sublinear_tf=True, max_features=20000), "text"),
            # The category the tenant picked.
            ("category", OneHotEncoder(handle_unknown="ignore"), ["category"]),
        ]
    )
    return Pipeline([("features", features), ("model", model)])


CANDIDATES = {
    "Logistic Regression": LogisticRegression(C=4.0, max_iter=3000, class_weight="balanced"),
    "Complement Naive Bayes": ComplementNB(alpha=0.3),
    "Random Forest": RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=SEED, n_jobs=-1),
}


def scores(y_true, y_pred):
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 3),
        "macro_f1": round(f1_score(y_true, y_pred, average="macro"), 3),
        "high_recall": round(recall_score(y_true, y_pred, labels=["HIGH"], average="macro"), 3),
        "high_precision": round(precision_score(y_true, y_pred, labels=["HIGH"], average="macro", zero_division=0), 3),
    }


# ---------- charts (palette: categorical slots 1-2, sequential blue) ----------
INK, MUTED, GRID = "#17201e", "#5d6b67", "#e3e7e6"
SERIES = ["#2a78d6", "#eb6834"]
BLUES = ["#f3f8fe", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]


def style_axes(ax):
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=MUTED, length=0)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def plot_confusion(cm, path, title):
    from matplotlib.colors import LinearSegmentedColormap

    cmap = LinearSegmentedColormap.from_list("blue", BLUES)
    fig, ax = plt.subplots(figsize=(5.2, 4.4), dpi=200)
    ax.imshow(cm, cmap=cmap, vmin=0, vmax=cm.max())
    for i in range(3):
        for j in range(3):
            v = cm[i, j]
            ax.text(j, i, str(v), ha="center", va="center", fontsize=13, fontweight="bold",
                    color="white" if v > cm.max() * 0.55 else INK)
    ax.set_xticks(range(3), [l.title() for l in LABELS], color=INK)
    ax.set_yticks(range(3), [l.title() for l in LABELS], color=INK)
    ax.set_xlabel("Predicted priority", color=MUTED)
    ax.set_ylabel("True priority", color=MUTED)
    ax.set_title(title, color=INK, fontsize=11, loc="left", pad=10)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(length=0)
    fig.tight_layout()
    fig.savefig(path, facecolor="white")
    plt.close(fig)


def plot_comparison(rows, path):
    short = {"Logistic Regression": "Logistic\nRegression", "Complement Naive Bayes": "Naive\nBayes",
             "Random Forest": "Random\nForest", "Keyword rules": "Keyword\nrules"}
    names = [short.get(r["name"], r["name"].replace("Complement Naive Bayes", "Naive Bayes").replace(" + ", "\n+ "))
             for r in rows]
    f1 = [r["macro_f1"] for r in rows]
    hr = [r["high_recall"] for r in rows]
    x = np.arange(len(names))
    w = 0.36
    fig, ax = plt.subplots(figsize=(7.6, 4.2), dpi=200)
    b1 = ax.bar(x - w / 2 - 0.01, f1, w, color=SERIES[0], label="Macro F1 (all levels)")
    b2 = ax.bar(x + w / 2 + 0.01, hr, w, color=SERIES[1], label="Recall on High")
    for bars in (b1, b2):
        for b in bars:
            ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.015, f"{b.get_height():.2f}",
                    ha="center", va="bottom", fontsize=8.5, color=INK)
    ax.set_xticks(x, names, color=INK, fontsize=9)
    ax.set_ylim(0, 1.08)
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0])
    style_axes(ax)
    ax.legend(frameon=False, loc="upper left", bbox_to_anchor=(0, 1.13), ncol=2, fontsize=9, labelcolor=INK)
    ax.set_title("Test set: wordings never seen in training", color=INK, fontsize=11, loc="left", pad=40)
    fig.tight_layout()
    fig.savefig(path, facecolor="white")
    plt.close(fig)


def hybrid(pipe, X, df):
    """Model prediction, but a safety word (fire, gas, sparks...) always means HIGH.
    This is the same safety net the AI service applies (see app.py)."""
    pred = pipe.predict(X)
    return [
        "HIGH" if has_safety_keyword(t, d) else p
        for p, t, d in zip(pred, df["title"], df["description"])
    ]


def evaluate_split(df, X, y, groups, label):
    """Hold out one fold of groups, train every method on the rest, score on the held-out part."""
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    tr, te = next(splitter.split(X, y, groups))
    print(f"[{label}] train {len(tr)} rows, test {len(te)} rows ({len(set(groups[te]))} held-out groups)")
    rows, fitted = [], {}
    for name, model in CANDIDATES.items():
        pipe = build_pipeline(model).fit(X.iloc[tr], y[tr])
        fitted[name] = pipe
        rows.append({"name": name, **scores(y[te], pipe.predict(X.iloc[te]))})
    test_df = df.iloc[te]
    rule_pred = [rule_priority(t, d, c) for t, d, c in zip(test_df["title"], test_df["description"], test_df["category"])]
    rows.append({"name": "Keyword rules", **scores(y[te], rule_pred)})
    rows.append({"name": "Always Medium", **scores(y[te], ["MEDIUM"] * len(te))})
    return tr, te, rows, fitted


def main():
    df = pd.read_csv(ROOT / "data" / "requests.csv")
    X, y = prepare(df), df["priority"].values
    templates, scenarios = df["template"].values, df["scenario"].values

    # ---- 1. model selection: grouped cross-validation (by sentence template) ----
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    tr0, _ = next(splitter.split(X, y, templates))
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    cv_results = {}
    for name, model in CANDIDATES.items():
        r = cross_validate(build_pipeline(model), X.iloc[tr0], y[tr0], groups=templates[tr0], cv=cv,
                           scoring={"macro_f1": "f1_macro", "accuracy": "accuracy"})
        cv_results[name] = {
            "macro_f1_mean": round(r["test_macro_f1"].mean(), 3),
            "macro_f1_std": round(r["test_macro_f1"].std(), 3),
            "accuracy_mean": round(r["test_accuracy"].mean(), 3),
        }
        print(f"CV {name:24s} macro F1 {cv_results[name]['macro_f1_mean']:.3f} ± {cv_results[name]['macro_f1_std']:.3f}")
    best_name = max(cv_results, key=lambda n: cv_results[n]["macro_f1_mean"])
    print(f"Best in cross-validation: {best_name}")

    # ---- 2. main test: new wordings of known problem types ----
    tr, te, test_rows, fitted = evaluate_split(df, X, y, templates, "unseen wordings")
    best_pipe = fitted[best_name]
    hyb = hybrid(best_pipe, X.iloc[te], df.iloc[te])
    test_rows.insert(len(CANDIDATES), {"name": f"{best_name} + safety words", **scores(y[te], hyb)})
    for r in test_rows:
        print(f"TEST {r['name']:40s} acc {r['accuracy']:.3f}  macro F1 {r['macro_f1']:.3f}  High recall {r['high_recall']:.3f}")
    cm = confusion_matrix(y[te], hyb, labels=LABELS)
    report = classification_report(y[te], hyb, labels=LABELS, digits=3, output_dict=True)

    # ---- 3. stress test: problem types never seen at all ----
    s_tr, s_te, stress_rows, s_fitted = evaluate_split(df, X, y, scenarios, "unseen problem types")
    s_hyb = hybrid(s_fitted[best_name], X.iloc[s_te], df.iloc[s_te])
    stress_rows.insert(len(CANDIDATES), {"name": f"{best_name} + safety words", **scores(y[s_te], s_hyb)})
    for r in stress_rows:
        print(f"STRESS {r['name']:38s} acc {r['accuracy']:.3f}  macro F1 {r['macro_f1']:.3f}  High recall {r['high_recall']:.3f}")

    # ---- 4. final model on all data ----
    final = build_pipeline(CANDIDATES[best_name]).fit(X, y)
    (ROOT / "model").mkdir(exist_ok=True)
    version = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    joblib.dump({"pipeline": final, "model_name": best_name, "version": version, "labels": LABELS}, ROOT / "model" / "model.joblib")

    # ---- 5. save results for the report ----
    res = ROOT / "results"
    res.mkdir(exist_ok=True)
    plot_confusion(cm, res / "confusion_matrix.png", "Deployed model, unseen wordings")
    chart_rows = [r for r in test_rows if r["name"] != "Always Medium"]
    plot_comparison(chart_rows, res / "model_comparison.png")

    metrics = {
        "trained_at": version,
        "dataset": {"rows": len(df), "scenarios": int(df["scenario"].nunique()), "templates": int(df["template"].nunique()),
                    "class_counts": df["priority"].value_counts().to_dict()},
        "cross_validation": cv_results,
        "chosen_model": best_name,
        "deployed_as": f"{best_name} + safety words",
        "test_unseen_wordings": {"rows": int(len(te)), "results": test_rows},
        "stress_unseen_problem_types": {"rows": int(len(s_te)), "held_out_scenarios": sorted(set(scenarios[s_te])), "results": stress_rows},
        "confusion_matrix": {"labels": LABELS, "rows_true_cols_predicted": cm.tolist()},
        "per_class": {k: {m: round(v, 3) for m, v in report[k].items()} for k in LABELS},
    }
    (res / "metrics.json").write_text(json.dumps(metrics, indent=2))
    write_report(metrics, res / "report.md")
    print(f"Saved model/model.joblib ({best_name}, version {version}) and results/")


def write_report(m, path):
    main_rows = m["test_unseen_wordings"]["results"]
    stress_rows = m["stress_unseen_problem_types"]["results"]
    t = {r["name"]: r for r in main_rows}
    st = {r["name"]: r for r in stress_rows}
    dep, rules = t[m["deployed_as"]], t["Keyword rules"]
    table = lambda rows: [
        "| Method | Accuracy | Macro F1 | High recall | High precision |",
        "|---|---|---|---|---|",
        *[f"| {r['name']} | {r['accuracy']:.3f} | {r['macro_f1']:.3f} | {r['high_recall']:.3f} | {r['high_precision']:.3f} |" for r in rows],
    ]
    c = m["dataset"]["class_counts"]
    lines = [
        "# Priority model results",
        "",
        f"Dataset: {m['dataset']['rows']} labelled requests from {m['dataset']['scenarios']} problem scenarios and "
        f"{m['dataset']['templates']} sentence templates (High {c.get('HIGH')}, Medium {c.get('MEDIUM')}, Low {c.get('LOW')}).",
        "",
        "## 1. Model selection (5-fold cross-validation, grouped by sentence template)",
        "",
        "| Model | Macro F1 (mean ± sd) | Accuracy |",
        "|---|---|---|",
        *[f"| {n} | {r['macro_f1_mean']:.3f} ± {r['macro_f1_std']:.3f} | {r['accuracy_mean']:.3f} |" for n, r in m["cross_validation"].items()],
        "",
        f"Chosen: **{m['chosen_model']}**. Deployed as **{m['deployed_as']}**: the model decides, but any safety word "
        "(fire, gas, sparks, burst, sewage, no water...) always gives High.",
        "",
        f"## 2. Main test: {m['test_unseen_wordings']['rows']} requests worded differently from anything in training",
        "",
        *table(main_rows),
        "",
        f"The deployed model reaches macro F1 {dep['macro_f1']:.2f} (keyword rules alone: {rules['macro_f1']:.2f}) and catches "
        f"{dep['high_recall'] * 100:.0f}% of truly High requests.",
        "",
        "Per class (deployed model):",
        "",
        "| Priority | Precision | Recall | F1 | Requests |",
        "|---|---|---|---|---|",
        *[f"| {k.title()} | {v['precision']:.3f} | {v['recall']:.3f} | {v['f1-score']:.3f} | {int(v['support'])} |" for k, v in m["per_class"].items()],
        "",
        "![Confusion matrix](confusion_matrix.png)",
        "",
        "![Model comparison](model_comparison.png)",
        "",
        f"## 3. Stress test: {m['stress_unseen_problem_types']['rows']} requests about problem types never seen in training",
        "",
        "Held-out problem types: " + ", ".join(m["stress_unseen_problem_types"]["held_out_scenarios"]) + ".",
        "",
        *table(stress_rows),
        "",
        "Scores drop sharply here: a model cannot rank a kind of problem it has never seen. This is why the deployed "
        "version keeps the safety words as a net, and why landlord overrides are logged as new training data.",
        "",
        "## Limitations",
        "",
        "- The data is synthetic (written from scenarios), because no public dataset of Kenyan tenant maintenance "
        "requests exists. Real requests and landlord overrides collected by the app should be added and the model retrained.",
        "- The keyword rules were written by the same person who wrote the scenarios, which flatters the rules baseline.",
        "- About 6% of labels were flipped on purpose to imitate inconsistent human labelling, so 100% is not reachable.",
        "- The model reads English (with some Swahili greetings). Requests written fully in Swahili or Sheng are not covered yet.",
    ]
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
