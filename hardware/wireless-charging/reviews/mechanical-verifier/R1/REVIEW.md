# Mechanical verifier review, revision R1 (analysis-only, no Fusion calls)
Inputs: PACKET.md R1, fusion-design-workflow.md. No geometry exists, so every number is an envelope calculation. Domain skills (material-selection, tolerance-stackup, machine-element-sizing) are not installed; method applied from own expertise. Cell data are typical datasheet values from memory, unverified (no searches made). Items marked A are my assumptions.

## 1. Pack mass and volume (3S1P)
| Option | Cells | Energy | Cell mass | Pack mass (+BMS, holder, wrap) | Envelope |
|---|---|---|---|---|---|
| 18650 3000 mAh (A: 47 g, 18.6x65.2) | 3 | 3x3.6x3.0 = 32.4 Wh | 141 g | ~160 g | 56x19x66 + BMS = ~75 cm3 |
| 21700 4000 mAh (A: 68 g, 21.2x70.5) | 3 | 43.2 Wh | 204 g | ~230 g | 64x22x71 + BMS = ~110 cm3 |
| Pouch 3x1.8 Ah (A: ~240 Wh/kg) | 3 | 3x1.8x3.7 = 20.0 Wh | ~85 g | ~100 g | ~50 cm3 incl. 10 % swelling allowance |

Energy need: 2 h x 8 W = 16 Wh output. With 92 % converter efficiency (A):
- +20 degC (80 % usable): 16/(0.8x0.92) = 21.7 Wh nominal. Pouch 20.0 Wh falls short by 1.7 Wh. 18650 and 21700 pass.
- -20 degC (A: 55 % usable): 16/(0.55x0.92) = 31.6 Wh. 18650 passes by only 0.8 Wh (2.5 %); 21700 passes; pouch fails.

## 2. Added mass (g, U200 without / with card reader)
U200 262/308; pack 160 / 230 / 100; Rx 11 (8 g coil + ~3 g PCBA, A); charger board 15 (A); harness, foam, sleeve 20 (A); extra housing 100 (A, +-50).
- 18650: 568/614 g. 21700: 638/684 g. Pouch: 508/554 g.
- Net of the S25 (A: ~160 g): +350 to +520 g.
- The CCS2 handle and cable masses are not in the packet and there is no target mass, so no pass/fail is possible. The cable pull will dominate wrist load. A 0.16 kg pack 80 mm off the grip axis is only ~0.13 N.m.
- The extra mass also hangs on the car inlet at varying angles. That load is not evaluated.

## 3. Thermal while on holster
Assumptions (A): effective area 0.07 m2 (handle ~250x100x60 mm, partly shielded by holster); external h = 10 W/m2K (convection plus radiation); 3 mm wall, k = 0.2, R = 0.015; UA = 0.07/(0.1+0.015) = 0.61 W/K. Internal film resistance adds 20-30 %. The 76 % figure is system (Tx to Rx) efficiency, and I assume half of the loss lands in the Rx.
- Central: U200 5 + Rx 2.4 (loss at 15 W out is 15/0.76-15 = 4.7 W, half = 2.4) + charger 0.8 + pack 0.1 = **8.3 W**, giving dT = 8.3/0.61 = 14 K, or **14-18 K** with internal film.
- Worst: U200 8 + Rx 4.7 (all loss assigned to the Rx) + charger 0.6 + pack 0.1 = **13.4 W**, giving **22-29 K**.
- Ambient limit to stay at or below 40 degC internal: central 22-26 degC; worst 11-18 degC. The 45 degC charge limit adds 5 K. **Fail** for Norwegian summer, even with no sun.
- Hot spots in the Rx and charger run higher than the bulk air.
- Cold: the internal temperature stays below 0 degC when ambient is below about -14 to -18 degC (central case). Thermal time constant is ~1.5 kJ/K / 0.61 = ~40 min. Charging must be inhibited (JEITA NTC) or a heater added; the Rx is also outside its 0-40 degC rating below 0 degC. Cold discharge is usable, but capacity is derated (section 1).
- Sun: absorbed power = alpha x 900 W/m2 x 0.025 m2 = 7 W (light, alpha 0.3) to 18 W (dark, alpha 0.8). That is +12 to +30 K before any electronics. A dark handle at 35 degC ambient reaches 47-65 degC without electronics, so **fail** for the battery, the Rx and PLA.
- The U200 operating temperature range and power draw are not published, so the U200 limits are not evaluated.

## 4. FDM material
| | HDT (typ.) | Creep/heat | UV | Impact, -25 degC | Verdict |
|---|---|---|---|---|---|
| PLA/PLA+ | ~55 degC | Softens in sun or car; creeps | Poor | Brittle | **Fail** outdoors with Li-ion; bench fit-check only |
| PETG | ~70 degC | Acceptable below ~60 degC | Moderate | Good | Conditional |
| ASA | ~90-95 degC | Best | Good | Good | **Recommended** (H2D enclosed chamber) |

None of these is flame-retardant (UL94 V-0 unknown). The battery bay needs an FR sleeve or FR filament. Printed walls are not watertight, so IP needs gaskets and coating (not evaluated). Generic datasheet values are not printed allowables, so coupons are advised.

Walls (0.4 nozzle, 0.42 mm lines, 100 % solid):
- Structure: 2.5-3.0 mm (6-7 perimeters), printed upright.
- Coil window: **2.1 mm (5 perimeters)**. The 2.5 mm limit is met, since 2.1 + 0.15 = 2.25 mm.
- Bay ribs and bosses: heat-set inserts in 3 mm walls. Avoid loading layer lines in tension across the window span.

## 5. Drop: 1 m onto asphalt (m = 1.3 kg, A)
E = 12.7 J, v = 4.4 m/s.
- **Window hit flat:** stop 3 mm gives F = 4.2 kN over 2475 mm2, so q = 1.7 MPa. The plate stress is 0.30 x q x b2/t2 = 0.30 x 1.7 x 45 x 45/4 = **~260 MPa**, or ~130 MPa if clamped. Printed ASA/PETG gives ~30-50 MPa, so **thickness cannot save the window; it fails by about 3-5x**.
- It survives only if the window is **recessed >= 1.5 mm behind a bumper rim** so the ground never touches it. The contents then see ~330 g (a = v2/2d at d = 3 mm = 3230 m/s2). The 12 g Rx assembly carries ~40 N, which is negligible. Add a local-point-load test (stone).
- **Pack:** 160 g x 3230 m/s2 = ~0.5 kN (3 mm stop), or ~1.6 kN at a 1 mm stop. Retain it by geometry: a captured bay with a 1.5 mm silicone foam crush layer on all sides, not tape. The bearing area is 1235 mm2, giving 0.4-1.3 MPa, which is fine. The cover screws then only restrain rebound.
- Cell crush keep-outs (A): no boss, screw tip, PCB edge or connector within 3 mm of the can wall on the impact side; at least 3 mm to the outer shell, plus foam.
- Cells are steel cans in the Qi field. Keep them 10 mm or more behind the ferrite and verify can temperature with a probe (foreign-object heating). Not evaluated.
- **Venting:** an 18650 vents at the positive end with hot gas and particles. A sealed gasketed shell will rupture at its weakest point, probably the screen or window, which faces the user. Provide a directed vent path from the cell vent ends toward the handle underside and away from the grip and screen, plus a pressure-relief membrane. Size it by test; I have no valid sizing number. Not evaluated.

## 6. Coil-gap tolerance chain (target 3.0-4.5 mm; spec definition ambiguous, so I assume coil-surface to coil-surface)
| Item | Nom | Tol (A) |
|---|---|---|
| Holster wall | 1.20 | 0.20 |
| Tx coil to inner wall | 0.20 | 0.10 |
| Handle window | 2.00 | 0.15 |
| Rx coil to inner wall | 0.20 | 0.10 |
| Subtotal (solid contact) | 3.60 | 0.55 |
| Air: seat 0.30 + holster 0.30 + tilt/play 0.40 | 0.15 | +1.00, clamped at 0 |

- **Design with an air gap:** the unclamped window is 2.20-5.30 mm. Clamped, it is 3.05-5.30 mm, which **fails** the 4.5 mm limit by 0.8 mm.
- RSS (3 sigma, independent) gives 3.75 +-0.65 = 3.10-4.40 mm. This is marginal, and the independence assumption is not demonstrated.
- **Design with contact (spring-loaded Tx or Rx carrier, air term = 0):** 3.05-4.15 mm, which **passes**. Exact margins are 0.05 mm at the minimum and 0.35 mm at the maximum. The 0.05 mm margin is at the limit, so it needs a measured window thickness.
- Lateral misalignment of the coil is not evaluated.

## 7. Findings register
| ID | Requirement | Model revision | Evidence | Check | Severity | Proposed correction | Responsible role | Status |
|---|---|---|---|---|---|---|---|---|
| MV-01 | Internal temperature <= 40 degC (Rx) and <= 45 degC (charge) on holster | R1 | Sec. 3: 8.3-13.4 W, +14-29 K, ambient limit 11-26 degC | fail | High | Cut heat load (U200 sleep on holster), conductive path to shell, NTC cut-off of Rx and charger, measure U200 | Mechanical verifier / electronics | open |
| MV-02 | No Li-ion charging below 0 degC; Rx rated 0 degC and up | R1 | Sec. 3: no self-heating below about -14 to -18 degC | fail | High | JEITA inhibit, pack heater or insulation, hold-off logic, cold test | Electronics | open |
| MV-03 | Summer sun survival | R1 | Sec. 3: +12-30 K before electronics | fail | High | Light colour, ASA, shade or vent, thermal derating | Industrial designer | open |
| MV-04 | >= 2 h at 8 W worst case | R1 | Sec. 1: needs 21.7 Wh at +20, 31.6 Wh at -20; pouch 20 Wh short | fail (pouch) / pass (18650, marginal in cold) | Medium | Choose 3S 18650 or larger (>= 32 Wh); measure the load | Coordinator | open |
| MV-05 | Added mass acceptable | R1 | Sec. 2: +350 to +520 g net; no target | not evaluated | Medium | Set target total mass; include inlet torque | Coordinator | open |
| MV-06 | Prototype material outdoors with Li-ion | R1 | Sec. 4 | fail (PLA) / pass (ASA) | High | ASA shell, PETG fallback, coupons | Fusion modeler / reviewer | open |
| MV-07 | 2.0 mm coil window survives 1 m drop | R1 | Sec. 5: ~130-260 MPa vs 30-50 MPa | fail (unprotected) | High | Recess >= 1.5 mm behind bumper, window 2.1 mm, drop test | Industrial designer / modeler | open |
| MV-08 | Battery retention and crush keep-outs | R1 | Sec. 5: 0.5-1.6 kN, no geometry | not evaluated | Medium | Captured bay, foam, 3 mm keep-outs | Modeler | open |
| MV-09 | Safe venting path | R1 | Sec. 5, no geometry or sizing | not evaluated | High | Directed vent away from user, relief membrane, vent test | Modeler / safety | open |
| MV-10 | Coil gap 3.0-4.5 mm | R1 | Sec. 6: 3.05-5.30 with air gap; 3.05-4.15 with contact | fail (air gap) / pass (contact) | High | Spring-loaded or contact seat, pocket, measure window thickness | Modeler | open |
| MV-11 | Cells not heated by Qi field | R1 | Sec. 5 | not evaluated | High | Keep >= 10 mm behind ferrite, probe can temperature | Electronics | open |
| MV-12 | IP rating and flame retardance of printed enclosure | R1 | Sec. 4, no IP target in packet | not evaluated | Medium | Gasket, coating, FR sleeve, define IP target | Coordinator | open |
| MV-13 | U200 temperature range and draw | R1 | Not in packet | not evaluated | Medium | Read U200 datasheet, measure load | Coordinator | open |
