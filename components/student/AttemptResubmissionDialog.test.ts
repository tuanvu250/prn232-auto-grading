import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// NOTE: this repo has no @testing-library/react or jsdom installed (see package.json /
// node_modules), and vitest's default environment is `node`, so real DOM rendering of a
// React client component is not currently possible here without adding new dependencies.
// Per the test-writing constraints for this task, we do NOT install a new framework just
// for this one component. Instead this is a static, source-level regression check for the
// specific, explicitly-called-out requirement: the lab <select> must never have a
// preselected default value, and submission must be blocked until a lab is chosen.
//
// This is a real but partial safety net — it will catch someone hard-coding a default
// value or relaxing the disabled guard, but it does NOT verify actual DOM behavior,
// event handling, or rendering. A true component test should be added once
// @testing-library/react + jsdom (or happy-dom) are introduced to this project.

const componentPath = fileURLToPath(
  new URL("./AttemptResubmissionDialog.tsx", import.meta.url)
);
const source = readFileSync(componentPath, "utf8");

describe("AttemptResubmissionDialog (static source checks)", () => {
  it("initializes classLabId state to an empty string (no preselected lab)", () => {
    expect(source).toMatch(/useState\(""\)\s*;?\s*\n?\s*(?:const \[driveLink)?/);
    expect(source).toMatch(/const \[classLabId, setClassLabId\] = useState\(""\)/);
  });

  it("renders the lab <select> bound to classLabId with no defaultValue prop", () => {
    const selectMatch = source.match(/<select[\s\S]*?>/);
    expect(selectMatch).not.toBeNull();
    const selectTag = selectMatch![0];
    expect(selectTag).toMatch(/value=\{classLabId\}/);
    expect(selectTag).not.toMatch(/defaultValue/);
  });

  it("has a disabled placeholder option with value=\"\" as the only initial option", () => {
    expect(source).toMatch(/<option value="" disabled>/);
  });

  it("gates canSubmit on classLabId being non-empty", () => {
    expect(source).toMatch(
      /const canSubmit = classLabId !== "" && driveLink\.trim\(\)\.length > 0 && !saving;/
    );
  });

  it("wires the submit button's disabled prop to canSubmit", () => {
    const buttonMatch = source.match(/<Button onClick=\{handleSave\}[\s\S]*?>/);
    expect(buttonMatch).not.toBeNull();
    expect(buttonMatch![0]).toMatch(/disabled=\{!canSubmit\}/);
  });

  it("resets classLabId back to empty string after a successful save or cancel", () => {
    const resetFn = source.match(/const reset = \(\) => \{[\s\S]*?\};/);
    expect(resetFn).not.toBeNull();
    expect(resetFn![0]).toMatch(/setClassLabId\(""\)/);
  });
});
