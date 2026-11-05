import { mergeFacts, mergePhases } from "../services/clientProjectService";

describe("client project merge", () => {
  it("keeps an edited phase when the conversation no longer mentions it", () => {
    const saved = [
      {
        id: "1",
        name: "Prototype",
        detail: "Changed by hand",
        date: "2026-11-18",
        edited: true,
      },
    ];
    const incoming = [
      {
        id: "new",
        name: "Development",
        detail: "In progress",
        date: null,
        edited: false,
      },
    ];

    const merged = mergePhases(saved, incoming);
    expect(merged.map((phase) => phase.name)).toEqual(["Prototype", "Development"]);
    expect(merged[0].detail).toBe("Changed by hand");
  });

  it("replaces an unedited fact with the new conversation value", () => {
    const saved = [
      { id: "1", label: "Prototype", value: "sometime", edited: false },
    ];
    const incoming = [
      { id: "2", label: "Prototype", value: "18 Nov 2026", edited: false },
    ];

    const merged = mergeFacts(saved, incoming);
    expect(merged).toEqual([
      { id: "1", label: "Prototype", value: "18 Nov 2026", edited: false },
    ]);
  });
});
