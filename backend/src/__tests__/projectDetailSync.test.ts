import { mergeReadme, nameMentioned, newFacts } from "../services/projectDetailSync";

describe("project detail matching", () => {
  it("matches the project name as a phrase", () => {
    expect(nameMentioned("The development project now has a prototype", "development project")).toBe(true);
    expect(nameMentioned("Discussing development of a prototype", "development project")).toBe(false);
  });

  it("keeps facts that are not already in the readme", () => {
    expect(newFacts("Prototype is in two weeks", ["Prototype is in two weeks", "Review moved to Friday"])).toEqual([
      "Review moved to Friday",
    ]);
  });

  it("appends only the new facts", () => {
    expect(mergeReadme("Prototype is in two weeks", ["Review moved to Friday"])).toBe(
      "Prototype is in two weeks\nReview moved to Friday"
    );
  });
});