# Industrial designer review, R1: internal layout with mandatory battery

Analysis-only, no Fusion calls. Inputs: fusion-design-workflow.md, PACKET.md (R1). Domain skills not installed; method applied from expertise. Units mm, g.

## Assumptions (outer form unknown, not invented geometry)
- A1: Our shell owns the grip volume; the sealed CCS2 body/cable boot passes through it. If the OEM grip is fixed, Concept A becomes a "chin pod" under the grip with the same pack (see ID-01).
- A2: FIT zone = flat patch >= 60 x 50 on a holster-facing face of the head; exact face unknown.
- A3: Handle hangs with nose axis 0-60 deg below horizontal depending on car; screen viewed within +/-30 deg cone.
- A4: Today's grip circumference ~120-135, comfort limit <= 140.
- A5: Pack = 3S1P 18650, 2500-3000 mAh (~27-32 Wh), ~140 g cells; 20 Wh floor stays until U200 draw is measured.

## Layout logic common to all concepts
- U200 on the upper/rear face of the head, screen normal tilted toward the viewer-side of the grip axis (parameter `screen_tilt_deg`), pocket 112 x 75 x 36 (43 with reader). Needs ~30 mm cavity behind it for RJ45 power plug bend, USB-A and SMA.
- Rx coil+ferrite (50x40x1.0) directly behind the holster-facing wall (<= 2.5), PCBA 32x17 beside it, ferrite back-side keep-out 5 to any cell, can, or metal.
- One "power board" (charger BQ25798 + BMS/NTC + 12 V out, ~60x40x8, ~20 g) in the head. Trimmed from separate charger and BMS boards.
- Heat map: Rx loses ~3.6 W when charging at 15 W (24 %), U200 ~2-4 W (unmeasured), charger ~1 W. All three live in the head; the cold, slow-to-heat grip is the natural place for cells.

## Concepts
**A. Pack in grip.** Three cells as a triangular cluster, vertical, in a cartridge cradle: ~38 x 36 x 66 core, ~50 x 48 outside walls, ~165 g with cradle. Cable enters grip base through a strain-relief collar. Head: U200 + power board + Rx. Total add-on mass ~0.8-0.9 kg, CoG at/near the hand. Cell-to-Rx path >= 60.
**B. Pack behind U200.** Cells in a 56 x 66 x 19 slab directly behind U200 in the head. Head depth ~36 + 30 + 21 + walls ~ 95. Slim grip, but nose-heavy cantilever and cells sit against the hottest parts.
**C. Pouch slab in grip wall.** 3S LiPo ~25 Wh, ~95 x 55 x 9, ~120 g, along the grip back wall. Slimmest grip, lowest mass, but swelling/abuse/cold concerns and no cell-level serviceability.

## Hard gates (pass/fail/not evaluated)
| Gate | A | B | C |
|---|---|---|---|
| Coil wall <= 2.5, flat to holster face | not evaluated (needs FIT geometry); layout allows | not evaluated; ferrite 5 mm keep-out squeezed | not evaluated; layout allows |
| Li-ion away from heat | pass (conditional on >= 40 clear of Rx, barrier to U200) | **fail** (cells adjacent to U200 + Rx) | pass (same condition) |
| Screen visible hanging in car | not evaluated (A3) | not evaluated | not evaluated |
| Fits holster nose-horizontal grip-down | not evaluated; grip girth growth is the risk | not evaluated; head depth ~95 is the risk | not evaluated |

## Weighted preferences (score 1-5, weight in brackets; max 75)
| | Ergonomics (5) | Balance (4) | Size vs today (3) | Battery service (3) | Sealing (3) | Total |
|---|---|---|---|---|---|---|
| A | 3 | 5 | 3 | 4 | 4 | 68 |
| B | 4 | 1 | 2 | 2 | 3 | 45 |
| C | 4 | 4 | 4 | 3 | 3 | 66 |

## Physical contradictions and trimming
- Capacity vs size/mass: capacity must be large (hours off-holster) and small (grip, mass). Separate in time and condition: size the pack for one session plus margin (20 Wh), not a day; top up in holster. Reduce the demand side first: U200 backlight dimming and sleep between sessions cut average load below 5 W, which scales mass 1:1.
- Cells must be warm (charge >= 0 deg C) and away from heat. Separate in time: a small heater pad on the pack, powered only when holstered, T < 5 deg C, Rx power available. Alternative: accept cold charge-inhibit with insulated cartridge (ID-03).
- Trimming: merge charger, BMS and Rx interface into one board; make the chassis half the cell cradle (no separate holder); strain-relief clamp and cartridge cap share one base part; back USB-A becomes a sealed service/debug port only, never a power input (removes one charge path and its protection). Production: delete it.

## Recommendation
**Concept A**, with C as fallback if grip girth exceeds 140 after Fusion check. Reasons: only concept passing the heat gate without a thermal barrier inside the head, best balance, cartridge access from the grip base cap for serviceability.

### User parameters for the Fusion thread
`u200_w=111.7, u200_h=74.6, u200_t=35.6, u200_t_reader=42.8, u200_clear=1.0, u200_rear_depth=30 (assumed), screen_tilt_deg=TBD, hang_angle_max=60 (A3), view_cone=30,`
`coil_w=50, coil_h=40, coil_t=1.0, rx_pcb_l=32, rx_pcb_w=17, rx_wall=2.0 (<=2.5), rx_flat_tol=0.3 (assumed), rx_ferrite_keepout=5, fit_flat_w=60, fit_flat_l=50 (A2),`
`cell_d=18.6, cell_l=65.2, cell_n=3, pack_wall=2.4, pack_to_rx_min=40, pack_to_u200_min=15, pack_mass=165,`
`pwr_board_l=60, pwr_board_w=40, pwr_board_t=8, grip_girth_max=140, grip_len_min=110 (assumed), cg_offset_max=20 (from hand axis), cable_od=TBD, strain_relief_len=90 (assumed), wall_t=2.4, mass_target=TBD.`

## Findings register
| ID | Requirement | Model revision | Evidence | Check | Severity | Proposed correction | Responsible role | Status |
|---|---|---|---|---|---|---|---|---|
| ID-01 | Layout needs our own grip volume | R1 | Packet silent on OEM grip vs shell (A1) | not evaluated | High | Coordinator confirms shell/OEM boundary; else chin pod | Coordinator | open |
| ID-02 | Li-ion away from heat; Rx 0-40 deg C | R1 | Rx loss ~3.6 W at 15 W; ambient -25..+40 exceeds Rx rating | fail (Rx range) | High | Cells >= 40 from Rx; confirm Rx cold limit with QST; thermal test | Mechanical verifier | open |
| ID-03 | Charge only >= 0 deg C | R1 | Holster is outdoors in Norway winter | not evaluated | High | Decide heater pad vs inhibit; insulate cartridge | Industrial designer / Mech. verifier | open |
| ID-04 | Screen visible when hanging | R1 | Hang angle range is assumption A3 | not evaluated | High | Measure hang angles on target cars; set `screen_tilt_deg` | Coordinator | open |
| ID-05 | Grip size | R1 | 3-cell cluster gives ~150 girth vs 140 limit (A4) | not evaluated | Medium | Fusion girth check; fall back to C or fewer Wh | Industrial designer | open |
| ID-06 | 20 Wh sizing | R1 | U200 draw unmeasured; 5/8 W assumed | not evaluated | Medium | Measure draw; apply dimming; resize pack | Coordinator | open |
| ID-07 | Drop survival | R1 | Grip base is the first asphalt impact point and holds cells in A | not evaluated | High | Crush zone/bumper, cell cradle isolation, drop test | Mechanical verifier | open |
| ID-08 | U200 NFC/4G function | R1 | Ferrite and steel cans near U200 rear can detune NFC/antenna | not evaluated | Medium | Keep Rx and cells >= 30 from NFC area; antenna in plastic nose | Industrial designer | open |
| ID-09 | Cable pull load path | R1 | Strain relief shares grip base with cartridge | not evaluated | Medium | Route pull load to chassis, not cartridge or cells | Mechanical verifier | open |
| ID-10 | Back USB-A role | R1 | Unresolved in packet | not evaluated | Low | Service/debug only, sealed cap, no power input | Coordinator | open |
