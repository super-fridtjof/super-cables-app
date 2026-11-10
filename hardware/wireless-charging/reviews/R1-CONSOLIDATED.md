# R1 design review: consolidated by coordinator

Inputs: PACKET.md R1 and the three specialist reports in `industrial-designer/R1`, `mechanical-verifier/R1`,
`power-reviewer/R1`. All analysis-only, no Fusion model exists. Manufacturing reviewer not used (prototype stage).

## Coordinator recheck (independent recompute of load-bearing numbers)
| Item | Reviewer result | Recheck | Verdict |
|---|---|---|---|
| Energy for 2 h at 8 W, +20 degC | 21.7 Wh (MV) | 16 / (0.80 x 0.92) = 21.74 Wh | agrees |
| Energy for 2 h at 8 W, -20 degC | 31.6 Wh (MV) | 16 / (0.55 x 0.92) = 31.62 Wh | agrees; 32.4 Wh pack has 2.5 % margin |
| Enclosure UA | 0.61 W/K (MV) | 0.07 / (1/10 + 0.015) = 0.609 W/K | agrees (assumption-driven) |
| Rx loss at 15 W out | 3.6 W (ID) vs 2.4-4.7 W (MV) | 15/0.76 - 15 = 4.74 W system loss; split Tx/Rx unknown | range carried; measure |
| Coil window plate stress, flat drop | ~260 MPa (MV) | 0.30 x 1.7 x 45^2 / 2^2 = 258 MPa | agrees |
| Coil gap chain, air gap | 3.05-5.30 mm (MV) | 3.60 - 0.55 = 3.05; 3.60 + 0.55 + 1.15 = 5.30 | agrees, fails 4.5 |
| Coil gap chain, contact seat | 3.05-4.15 mm (MV) | 3.60 +/- 0.55 | agrees, passes; 0.05 mm low margin |
| Recharge 20 Wh at 8 W load | 3.2 h (PW) | 20 / (15 x 0.95 - 8) = 3.2 h | agrees |
| Added mass vs S25 | +350-520 g (MV), "0.8-0.9 kg add-on" (ID) | ID figure includes housing growth; MV is electronics + 100 g housing | conflict noted, no target mass to resolve |

## Decisions taken for R2
1. **Battery: 3S1P Li-ion 18650, 3000-3500 mAh (32-39 Wh).** 2S rejected (below U200 7 V min, PW-04). Pouch 20 Wh rejected (fails 2 h at 8 W, MV-04). 3S2P rejected (mass, recharge time).
2. **Charger: TI BQ25798 NVDC buck-boost** (12 V Rx in, 3S out, power path keeps U200 running on Qi dropout). Prototype on BQ25798EVM + prebuilt protected pack + MCU I2C host + eFuse. Datasheet confirmation pending (PW-05).
3. **Layout: Concept A** (cells in the grip as a cartridge; U200, Rx and power board in the head; cells >= 40 mm from Rx). Fallback C if grip girth > 140 mm.
4. **Coil seat must be contact-type** (spring-loaded Tx carrier in the holster), window recessed >= 1.5 mm behind a bumper rim; holster boss enters the recess. Air-gap seat fails the tolerance chain (MV-10) and an exposed window fails the drop (MV-07).
5. **Prototype shell material ASA** (PETG fallback). PLA only for bench fit checks (MV-06).
6. **R0 PTC fuse replaced** by a 5 A fuse at the pack plus an eFuse with soft-start before the U200 (PTC drifts at -25 degC, PW).
7. **Back USB-A = service port only**, default off, 500 mA limit (PW-09, ID-10).

## Hard gates still failing (block field use, not bench use)
| Gate | Findings | Path |
|---|---|---|
| Charging below 0 degC | PW-01, MV-02, ID-03 | JEITA lockout + insulated bay + 2 W heater when holstered; freezer test |
| Qi Rx outside 0-40 degC | PW-02, ID-02 | Vendor query to QST for extended range; chamber test; production Rx on Renesas/TI industrial-grade IC |
| Internal temperature on holster in summer and sun | MV-01, MV-03, PW-07 | U200 sleep on holster, light colour, conductive path to shell, charger derating by NTC; measure |
| Safe venting | MV-09 | Directed vent to handle underside, relief membrane; test |

## Open inputs only the team can give
- ID-01: does our shell own the grip, or is the OEM CCS2 grip fixed?
- MV-05: target total handle mass.
- ID-04: measured hang angles on target cars.
- MV-12: IP target for the prototype.
- PW-03 / MV-13: measured U200 draw and temperature range (Stage 1 of the measurement plan).

## Merged register
All rows from the three reports stand as written in their files (ID-01..10, MV-01..13, PW-01..11).
Duplicates are grouped above; no row has been edited into a pass.
