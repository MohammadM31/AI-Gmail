import { useState } from "react";
import type { EmailItem } from "../../types";
import { EmailList } from "./EmailList";
import { EmailDetail } from "./EmailDetail";

export function ThreadView() {
  const [selected, setSelected] = useState<EmailItem | null>(null);

  if (selected) {
    return (
      <EmailDetail
        email={selected}
        onBack={() => setSelected(null)}
        onUpdated={(email) => setSelected(email)}
      />
    );
  }

  return <EmailList onSelect={setSelected} />;
}
