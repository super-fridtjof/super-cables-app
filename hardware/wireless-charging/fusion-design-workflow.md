---
name: "fusion-design-workflow"
description: "House rules for Fusion-based product development and its coordinator/specialist roles; use for any Fusion CAD design, review, print-prep or manufacturing-handoff task."
---

# Fusion design workflow (companion skill)

These rules apply to the coordinator and to every specialist agent. A specialist does not inherit the
coordinator's conversation: it works only from this skill, its domain skills, the project packet it is
given and its explicit assignment.

## 1. Source of truth
- Fusion is the primary CAD environment. The native parametric Fusion document is the authoritative,
  editable source. Identify it by document name, Fusion version/save number and timeline state.
- Exports (STEP, STL, 3MF), drawings, screenshots, meshes and slicer projects are derivatives of one
  specific native revision. Label every derivative with that revision; never let a review of an older
  derivative approve a newer model.
- Preserve parameters, design intent, component structure, joints, units and revision traceability.
  Prefer editing existing features/parameters over adding disconnected geometry. Name new features and
  bodies descriptively and group them per revision in the timeline.

## 2. Tools: discover, don't invent
- Use the existing Fusion connection and text-to-CAD setup. Discover the actual tools available in the
  session before planning; never invent tool calls or assume an integration exists.
- Capabilities verified on this setup (re-check each session, they can change):
  - `Autodesk_Fusion__fusion_mcp_execute` (featureType `script`): runs Fusion Python API scripts. This is
    the only route for geometry measurement AND modification. `readOnly: true` is enforced by Fusion, but
    the same tool can write, so it is restricted to the Fusion modeler role. A failing script rolls back
    all of its changes; scripts must end with `def run(context=None): pass`; ~60 s per call.
  - `Autodesk_Fusion__fusion_mcp_read`: screenshots, open/recent documents, projects, API docs,
    licensing. No model modification. Safe for reviewers.
  - `Autodesk_Fusion__fusion_mcp_update`: undo/redo only (modeler only).
  - text-to-CAD (`cad` CLI, build123d/OpenCASCADE): independent analysis on exported STEP/STL - DFM
    checks (`cad dfm`), FEA (fea skill, CalculiX), drawings. Its results are external analysis, kept
    separate from the editable Fusion source; never treat a build123d re-model as the master.
- Map upstream skill examples written for other CAD tools (AutoCAD, FreeCAD, SolidWorks, Codex-style
  agents) to equivalent Fusion operations where possible; report operations with no Fusion equivalent
  as `unsupported` instead of improvising. See the compatibility appendix below.

## 3. Design method
- Develop function, materials, manufacturing process, geometry, ergonomics and appearance together.
- Use `industrial-product-design-gbt` for new products, substantial redesigns, form, ergonomics,
  packaging, assembly and serviceability. Scale its process to the task: local edits do not restart
  concept selection.
- Drawing and tolerancing standards: apply the project's selected standard consistently. Use GB/T only
  when explicitly required. Defer the choice until the project requirements (market, supplier,
  customer) are known, and record it in the packet once chosen.
- Use `physical-contradictions` when one parameter must genuinely take opposing values, and `trimming`
  to remove unnecessary parts or complexity. Prefer automatic analysis with stated assumptions over
  repeated confirmation questions.
- Repository rules, rules of thumb and material tables (e.g. `materials.csv`, DFM rule tables) are
  preliminary guidance until their applicability to the actual process, grade and supplier is shown.

## 4. Roles and CAD access
| Role | Skills (always plus this one) | May modify Fusion? |
|---|---|---|
| Design coordinator (main session) | design-review-package | Only when acting as sole CAD operator |
| Industrial designer | industrial-product-design-gbt, physical-contradictions, trimming | No |
| Fusion modeler | text-to-CAD `cad` skill | Yes - the only role |
| Mechanical verifier | material-selection, machine-element-sizing, tolerance-stackup | No |
| Manufacturing reviewer | dfm-review, design-review-package (review guidance) | No |

- Reviewers work from exported evidence (STEP/STL, screenshots, measurement tables) and may request
  additional live measurements through the modeler. They write calculations and reports only in their
  own work folder: `<project>/reviews/<role>/<revision>/`.
- If the Fusion connector is not available to a modeler subagent, or the specialist agent definitions
  are not loaded with tool allowlists, the main session is the sole CAD operator and specialists are
  analysis-only and must not call Fusion tools. State this arrangement in the packet.
- When spawning a specialist, give it: this skill, its domain skills (paths), the relevant packet
  sections, the revision label, its work folder and an explicit assignment.
- Use only the specialists a task needs.

## 5. Project packet (shared design basis)
Every assignment includes the relevant parts of the packet (template below): requirements with
priorities and measurable acceptance criteria; native model identity, revision, configuration and units;
materials, process, quantity, loads, environment, critical interfaces; parameters, measurements, views,
exports, calculation inputs; confirmed facts vs assumptions vs missing information vs unresolved
decisions. Every review states the revision and the inputs it examined.

## 6. Cycle and findings
Requirements -> concept comparison -> Fusion model -> parallel specialist reviews -> prioritized
corrections -> revised model -> recheck affected requirements -> prototype or manufacturing handoff.

- Each finding records: requirement, model revision, evidence, severity, proposed correction,
  responsible role, status (template below).
- Checks are `pass`, `fail` or `not evaluated`. Missing evidence stays visible; never fill it with an
  assumption labelled as a result.
- Reviewers independently recompute important results and inspect real measurements where practical.
  Agreement between agents is not evidence.
- After a design change, invalidate the checks it affects and rerun them on the new revision.
- Keep hard requirements (pass/fail gates) separate from weighted concept preferences so a critical
  failure cannot disappear inside an overall score.

## 7. Prototype vs production acceptance
**3D printing (prototype):** name the actual process, material, machine and relevant settings (for this
user typically Bambu Lab H2D, FDM, PLA/PLA+, 325 mm max height, printed upright). For FDM consider
orientation vs load direction, layer adhesion, walls/perimeters, supports, creep, temperature (Nordic
cold and summer heat), inserts and calibrated fits. Generic datasheet properties are not printed-part
allowables. Recommend test coupons when fit, strength or process uncertainty materially affects the
design.

**Production development:** reassess process, material grade, quantity, tooling, tolerances, assembly,
inspection, finish and cost; list prototype assumptions that no longer hold; track supplier feedback,
calculations, inspections and physical validation; name missing capabilities (fatigue, specialised
simulation, CAM/post-processing, tooling validation, physical testing).

**Maturity labels:** concept, prototype candidate, production-development candidate, release
candidate - each with the evidence behind it and the unresolved work.

---

## Appendix A: compatibility adaptations (kept separate from upstream content)

Upstream skills are installed unmodified. How to apply them in this Fusion setup:

| Upstream skill | Upstream assumption | Adaptation here |
|---|---|---|
| industrial-product-design-gbt | Written for "Codex"; AutoCAD / AutoCAD MCP drafting; GB/T handoff to `mechanical-drafting-gbt` | Read "Codex" as the current agent. CAD steps map to Fusion API scripts through the modeler. AutoCAD MCP references are `unsupported`. GB/T only on explicit request; `mechanical-drafting-gbt` intentionally not installed. `agents/openai.yaml` is ignored. |
| dfm-review | Generic process rule tables | Preliminary; for FDM check against the actual printer/material and coupons; for moulding confirm with supplier. Cross-check with text-to-CAD `cad dfm` on a revision-labelled export. |
| material-selection | Bulk `materials.csv` properties | Bulk values are not printed-part allowables; use process-specific FDM data. |
| tolerance-stackup | 1-D chains from user input | Chain dimensions come from modeler measurements of a named revision or the drawing; record source per row. |
| machine-element-sizing | Metallic elements, Shigley methods | Flag where plastic/printed parts make methods inapplicable (creep, anisotropy). |
| design-review-package | Generic PDR/CDR package | Coordinator owns it; the requirements matrix is the packet's register. |
| physical-contradictions / trimming | Pure method skills | State assumptions instead of repeated questions. |

Fusion equivalents for common upstream CAD steps:
- Parametric sketch/extrude/revolve/loft/fillet -> Fusion API features via `fusion_mcp_execute` script.
- Read back entities/parameters -> read-only script, list timeline, bodies, volumes.
- Interference/clearance -> TemporaryBRepManager boolean intersection on copies; ray casts for wall checks.
- Export STEP/STL -> `exportManager` from a script; name the file with document + revision.
- Screenshots -> `fusion_mcp_read` screenshot or viewport `saveAsImageFile`.
- 2D drawings with GD&T -> Fusion Drawing workspace not scriptable through this connector: `unsupported`; produce drawings from STEP with text-to-CAD and label them derivative.

Known upstream behaviour (setup test 2026-11-09): tolerance-stackup `stackup.py` computes `worst_case_ok`
in floating point; an exactly-at-limit result (0.20 vs 0.20) can pass by rounding (0.2000000000000007).
For at-limit results take the verdict from exact (Decimal) arithmetic and report the margin.

## Appendix B: project packet template

```
# Project packet - <project>
1. Native model: Fusion document <name>, version/save <vN>, revision <R?>, units mm,
   timeline marker <...>, CAD operator arrangement <modeler subagent | main session sole operator>
2. Requirements register: ID | requirement | type (hard / preference+weight) | measurable criterion | source | status
3. Design basis: materials, process, machine/settings, quantity, loads & environment, critical interfaces,
   drawing/tolerancing standard (TBD until requirements known)
4. Evidence for this revision: parameters, measurements (with method), views/exports (file + revision), calc inputs
5. Knowledge state: confirmed facts / stated assumptions / missing information / unresolved decisions
6. Revision register: revision | date | change | checks invalidated | rechecked
```

## Appendix C: findings register

| ID | Requirement | Model revision | Evidence | Check (pass/fail/not evaluated) | Severity | Proposed correction | Responsible role | Status |
|---|---|---|---|---|---|---|---|---|

One row per finding per revision. When a revision changes, mark affected rows `superseded` and add new
rows for the recheck - never edit an old row into a pass.