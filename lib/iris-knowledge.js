/**
 * Loads the Iris knowledge base (knowledge/*.md) into a single grounding
 * string for the assistant's system prompt. Edit the markdown files to change
 * what Iris knows — this loader just concatenates them (sorted by filename).
 * HTML comments (owner-facing GAP notes) are stripped before the model sees it.
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "knowledge");
let cache = null;

function load() {
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
  } catch (e) {
    return "";
  }
  return files
    .map((f) => {
      try {
        return fs.readFileSync(path.join(DIR, f), "utf8");
      } catch (e) {
        return "";
      }
    })
    .join("\n\n---\n\n")
    .replace(/<!--[\s\S]*?-->/g, "") // drop owner-only GAP notes
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = {
  get knowledge() {
    if (cache == null) cache = load();
    return cache;
  },
  reload() {
    cache = null;
    return this.knowledge;
  },
};
