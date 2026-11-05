import { statedNumberChart } from "../services/infographicService";

describe("stated number charts", () => {
  it("charts a single stated percentage and ignores the meeting time", () => {
    const chart = statedNumberChart(
      "a meeting at 7pm for discussing the steep 70% decrease in client sales with Hadi and Sarah"
    );
    expect(chart).toEqual({
      kind: "chart",
      type: "bar",
      title: "decrease in client sales",
      labels: ["decrease in client sales"],
      values: [70],
    });
  });

  it("charts every percentage in the message", () => {
    const chart = statedNumberChart("The app grew 75% and clients increased 25%");
    expect(chart?.values).toEqual([75, 25]);
    expect(chart?.labels).toHaveLength(2);
  });

  it("returns nothing when the message has no percentage", () => {
    expect(statedNumberChart("Meeting at 7pm, boss is joining")).toBeNull();
  });
});
