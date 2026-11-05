// Test-only stand-in for "jsdom".
//
// jsdom@29 depends on ESM-only packages (@exodus/bytes) that Jest's CommonJS
// runtime can't parse, which made every suite fail on import of
// src/utils/sanitize.ts. sanitizeHtml only uses textContent -> innerHTML
// (i.e. HTML escaping), so this stub reproduces exactly that.
// Mapped via moduleNameMapper in jest.config.js. Remove once sanitizeHtml
// no longer depends on jsdom.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

class FakeElement {
  private text = "";

  set textContent(value: string) {
    this.text = value;
  }

  get textContent(): string {
    return this.text;
  }

  get innerHTML(): string {
    return escapeHtml(this.text);
  }
}

export class JSDOM {
  window = {
    document: {
      createElement: (_tag: string) => new FakeElement(),
    },
  };

  constructor(_html?: string) {}
}
