"""Draw one infographic PNG from a JSON spec on stdin. Bytes go to stdout."""

import json
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

spec = json.load(sys.stdin)
kind = spec.get("kind")
title = str(spec.get("title") or "")[:120]
fig, ax = plt.subplots(figsize=(8, 4.2), dpi=120)
fig.patch.set_facecolor("#f7f5f2")
ax.set_facecolor("#f7f5f2")
accent = "#c73e54"

if kind == "chart":
    labels = [str(label)[:40] for label in (spec.get("labels") or [])]
    values = [float(value) for value in (spec.get("values") or [])]
    count = min(len(labels), len(values))
    labels = labels[:count]
    values = values[:count]
    chart_type = spec.get("type") or "bar"
    if chart_type == "pie":
        ax.pie(values, labels=labels, autopct="%1.0f%%", colors=["#c73e54", "#1f4b6e", "#e0a106", "#2f6f4e", "#6b4c9a"])
    elif chart_type == "line":
        ax.plot(labels, values, marker="o", color=accent, linewidth=2)
        ax.set_ylabel("")
    else:
        ax.bar(labels, values, color=accent)
    ax.set_title(title, loc="left", fontsize=13, pad=12)
    ax.tick_params(axis="x", labelrotation=20)
else:
    facts = [str(fact)[:180] for fact in (spec.get("facts") or [])][:6]
    ax.axis("off")
    ax.set_title(title or "Facts", loc="left", fontsize=14, pad=8)
    for index, fact in enumerate(facts):
        ax.text(0.02, 0.82 - index * 0.16, "•  " + fact, transform=ax.transAxes, fontsize=12, va="top")

fig.tight_layout()
fig.savefig(sys.stdout.buffer, format="png")
plt.close(fig)
