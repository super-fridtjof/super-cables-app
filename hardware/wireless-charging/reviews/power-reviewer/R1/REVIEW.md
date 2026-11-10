# Power/Battery review - R1 (analysis-only, no Fusion calls)
Inputs: fusion-design-workflow.md, PACKET.md R1. Domain skills not installed; own expertise used. Web: 1 search + 1 distributor page (TI product page blocked by allowlist). Everything not marked "verified" is from memory/engineering estimate and must be checked against the datasheet.

## 1. Recommendation
**3S1P Li-ion (NMC, 18650), 33-39 Wh, behind a BQ25798 NVDC buck-boost charger, BMS-protected, with a pack heater for cold start.** Option B (2S) is rejected, C/D kept as later options.

```
Holster Tx 12V/15W ~~Qi~~> Rx QPR-0108 (12V,<=1.25A) -> TVS SMBJ15A -> VBUS
   VBUS -> BQ25798 (buck-boost, NVDC, I2C, TS=pack NTC) -> VSYS(=Vbat, ~9-12.6V) -> eFuse/load switch -> U200 RJ45 (7-48V)
   BQ25798 BAT <- fuse 5A <- BMS (3S, balance, OV/UV/OC/SC, NTC) <- 3S 18650
   MCU (I2C host, watchdog, SoC, heater FET, Rx-temp ADC) from VSYS via 5V buck
   VSYS -> heater FET -> 2 W film heater on pack (only when Qi present and T_pack < +5 C)
   Option: VSYS -> 5V buck (current-limited, default OFF) -> rear USB-A
```

## 2. Checks
**U200 >= 7 V (PASS for 3S, FAIL for 2S).** 3S window with BMS cutoff 3.0 V/cell: 9.0-12.6 V. Cold sag: 3S of ~30 mohm cells at 3x cold resistance plus BMS FET is ~0.3 ohm; at 8 W (0.8 A) sag is ~0.25 V, so worst case ~8.7 V, margin ~1.7 V. 2S is 6.0-8.4 V and sags below 7 V for the lower ~40 % of the curve, so a boost would be mandatory (extra stage, no benefit). 4S (12-16.8 V) would need a boost for Qi charging.

**Energy sizing** (nominal Wh = P x t / 0.8 for ageing/cold/conversion; assumes 80 % usable; cold -20 degC capacity can be 60-70 % so ADD margin outdoors). Charge time = nominal Wh / net charge power, net = (15 W x 0.95 buck-boost) - load; 15 W is Tx rating, real alignment/gap will be lower (not evaluated).

| Duration | 5 W: Wh nominal / recharge | 8 W: Wh nominal / recharge |
|---|---|---|
| 1 h | 6.3 / 0.7 h | 10 / 1.6 h |
| 2 h | 12.5 / 1.3 h | 20 / 3.2 h |
| 4 h | 25 / 2.6 h | 40 / 6.5 h |
Recharge assumes U200 runs during charge (net 9.5 W at 5 W load, 6.2 W at 8 W load) and a full 0-100 % cycle (CV tail adds ~20 %). Challenge to the draft: the "2 h x 8 W" case is a worst-case *sum*; a charge session is 20-60 min, so 1 h at 8 W (10 Wh) is the real autonomy need, and a day of back-to-back sessions is limited by recharge in the holster, not by capacity. Recommend 3S1P 3000-3500 mAh (33-39 Wh, ~140 g with cells only): covers 2 h at 8 W with 40 % spare. Do not go 3S2P: ~280 g on a hand-held, cable-loaded handle, and the holster cannot recharge it at 8 W load.

**Cold charging.** Li-ion must not charge below 0 degC (plating); BQ25798 JEITA via TS pin (cold/cool/warm/hot thresholds programmable via I2C, default 0/10/45/60 degC - unverified) handles lockout. Consequence: in a -25 degC outdoor holster the pack will NOT charge, and the Qi power will only run the U200. Remedy: heater (2 W film, ~30-60 min to lift a 140 g pack ~25 K when insulated; Qi can supply it since it is otherwise idle) plus insulated battery bay. Standard cells are rated -20 degC discharge (some -30/-40, check cell) - a pack that starts a session at -25 degC is outside most cell specs, but U200 self-heat (5 W) in an insulated bay helps. LTO or LFP do not solve this (LFP also cannot charge < 0 degC; LTO charges to -30 degC but ~70 Wh/kg gives ~15 Wh in the same mass; 5S LTO is a production research item). Qi Rx is rated 0-40 degC only: below 0 degC and in sun at +40 degC it is outside spec; cold-chamber test of Rx and Tx handshake required.

## 3. Charger/power-path
BQ25798 claim: partly verified. Verified this session (Digi-Key page): BQ25798EVM exists, Li-ion/Li-pol 1-4 cells, 62 in stock, 12-week manufacturer lead time. From memory, to confirm on datasheet: VBUS 3.6-24 V (abs max 30 V), buck-boost, NVDC power path with VSYSMIN, TS pin JEITA, up to 5 A, I2C host required, OTG, ship mode, -40..85 degC. The claim is credible and 12 V in to 3S out works because it is a buck-boost. Caveats: (a) needs an I2C host MCU and watchdog service/disable - no fuel gauge inside (production: add BQ40Z50 or MAX17320); (b) set IINDPM <= 1.1 A and VINDPM ~9 V so the charger never pulls the Rx beyond 12 V x 1.25 A (a collapsing Rx makes the Tx drop and retry); (c) Rx output starts at 5 V before negotiating 12 V, so input must tolerate 5 -> 12 V steps (UVLO 3.6 V: ok). Alternative if no MCU wanted: none found that does 12 V -> 3S power path standalone; stay with BQ25798.

**Prototype route (no custom PCB):** BQ25798EVM + prebuilt 3S 18650 pack with PCM/NTC + small MCU board (ESP32/RP2040) for I2C + inline eFuse module. EVM may need TI USB2ANY/EV2400 interface or its own I2C header (check user guide). Strap cell count via PROG per datasheet.

## 4. Protection and safety
- BMS: 3S, OV 4.25 V, UV 2.8-3.0 V, OC ~5 A, SC, balance, NTC input, common charge/discharge port. Fuse 5 A/32 V slow-blow within 50 mm of cells (PTC not recommended at -25 degC).
- TVS SMBJ15A on VBUS (Qi dropout/Tx stop spikes); a second on VSYS. NTCs: (1) 10 k NTC bonded between the middle cells to TS (hottest point); (2) NTC on Rx PCB to MCU ADC (0-40 degC derate); (3) optional NTC near U200.
- Qi dropout: NVDC switches to battery without interruption; MCU logs it. Debounce Tx retries.
- Inrush at boot: U200 input capacitance unknown; put a programmable-dV/dt eFuse (e.g. TI TPS25947, unverified) between VSYS and U200, also giving MCU-controlled cut-off. Verify RJ45/MDB power pin polarity before connecting (reverse polarity fit protection).
- Metal cell cans next to the coil heat by eddy current: keep ferrite between Rx coil and cells, >= 5 mm gap, thermocouple test. PLA softens ~55-60 degC: use PETG/ASA around the pack, keep pack < 45 degC.
- Prototype rules: buy a certified prebuilt pack (no DIY spot welding or soldering to cells); first 10 cycles attended, in a fireproof box/LiPo bag with sand and an extinguisher near; current-limited supply for bring-up; verify cold lockout in a freezer with the pack, thermocouple and no human in the loop; no public use; remove pack for 3D print rework; drop test cells unpowered.
- Later: IEC 62133-2:2017 (cell+pack), UN 38.3 (T1-T8; <100 Wh so UN3481 packed-with-equipment applies), EN 62368-1 (PS2/PS3 classification, battery Annex M), EU Battery Regulation 2023/1542 (applicability to check), RED for the Qi link.

## 5. Back USB-A
Recommend NOT a public 5 V output. A phone draws 7.5-15 W and would halve autonomy while adding IP, abuse and liability exposure. Keep only as a current-limited (500 mA, e.g. a load switch), default-OFF service/debug port from a separate 5 V buck off VSYS; impact <= 2.5 W when used. Do not use BQ25798 OTG (it shares VBUS with the Rx).

## 6. Battery-path BOM (prices indicative, NOK/USD estimates, mostly NOT verified)
| Part | Number | Source | Price | Verified |
|---|---|---|---|---|
| Charger EVM | BQ25798EVM | Digi-Key (digikey.no), Mouser | price not retrieved (est. USD 100-150) | y (exists, 1-4S, 62 stk, 12 wk lead) |
| 3S1P prebuilt pack w/ PCM, NTC, 3.0-3.5 Ah 18650 | to select (Samsung 35E / Molicel P28A cells) | Farnell/Elfa/Kjell, else cell vendor | est. NOK 400-800 | n |
| MCU I2C host | ESP32 or RP2040 dev board | Kjell/Elfa | est. NOK 100-200 | n |
| eFuse | TPS25947 (EVM or chip) | Mouser/Digi-Key | est. USD 2-30 | n |
| TVS | SMBJ15A | RS/Farnell | est. NOK 5 | n |
| Fuse 5 A 32 V | SMD or inline | RS/Farnell | est. NOK 10 | n |
| Pack NTC 10 k | e.g. Murata NCP18XH103 | Farnell | est. NOK 5 | n |
| Film heater 12 V 2 W | generic Kapton | Kjell/Elfa/AliExpress | est. NOK 50 | n |
| Logger | INA226 breakout | Kjell/Elfa | est. NOK 80 | n |

## 7. Findings register
| ID | Requirement | Model revision | Evidence | Check | Severity | Proposed correction | Responsible role | Status |
|---|---|---|---|---|---|---|---|---|
| PW-01 | Charge at -25..+40 degC outdoors | R1 | Li-ion no charge < 0 degC; JEITA | fail | High | Insulated bay + 2 W heater + lockout; freezer test | Power/Industrial designer | open |
| PW-02 | Qi Rx works in ambient range | R1 | Rx rated 0-40 degC only | fail | High | Cold/hot chamber test; derate via Rx NTC; vendor query | Power | open |
| PW-03 | U200 load known | R1 | draw unpublished | not evaluated | High | Measure at 7/12/12.6 V incl. boot peak, 4G | Power | open |
| PW-04 | U200 >= 7 V over discharge | R1 | 3S 9.0-12.6 V, cold sag ~0.25 V | pass (3S), fail (2S) | Medium | Adopt 3S; drop B | Power | open |
| PW-05 | BQ25798 suitability | R1 | EVM verified; specs from memory | not evaluated | Medium | Confirm datasheet; I2C host, watchdog, IINDPM <= 1.1 A | Power | open |
| PW-06 | Energy/charge time | R1 | table above | not evaluated | Medium | Size 33-39 Wh; check at measured load and real Qi power | Power | open |
| PW-07 | Thermal in sealed enclosure | R1 | Rx loss ~3.6 W, eddy heat in cans, PLA ~55 degC | not evaluated | High | Ferrite + gap + PETG/ASA; thermocouple test | Power/Mechanical | open |
| PW-08 | U200 boot inrush and polarity | R1 | capacitance unknown | not evaluated | Medium | eFuse with soft start; verify pinout | Power | open |
| PW-09 | Rear USB-A role | R1 | phone load 7.5-15 W | not evaluated | Medium | Off by default, 500 mA service port only | Coordinator | open |
| PW-10 | Mass/CG | R1 | ~140 g cells, ~180 g total est. | not evaluated | Medium | Place low in grip; target mass from designer | Industrial designer | open |
| PW-11 | Compliance path | R1 | 62133-2, UN38.3, 62368-1 | not evaluated | Low | Plan certified cells/pack in V2 | Coordinator | open |
