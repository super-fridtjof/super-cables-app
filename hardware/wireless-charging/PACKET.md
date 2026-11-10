# Project packet: Super Cables handle, wireless charging + battery prototype

Revision: **R1** (design basis only, no CAD yet). Date 2026-11-10. Units mm, V, W, Wh.
Coordinator: main session. Companion rules: `fusion-design-workflow.md` in this folder.

## 1. Native model and CAD arrangement
- No Fusion model of this chassis exists yet. The Fusion connector is NOT available to subagents in this
  session. Arrangement: **specialists are analysis-only**; no Fusion tool calls. Geometry statements are
  envelope-level requirements for the later Fusion thread.
- Domain skills named in the companion file (industrial-product-design-gbt, material-selection, dfm-review,
  tolerance-stackup, ...) are NOT installed here. Apply their method from your own expertise and say so.

## 2. Product context (confirmed facts)
- Product: a CCS2 (IEC 62196-3 config FF) DC fast-charging handle ("pistol") with an integrated touchscreen
  and payment, used by EV drivers at public chargers. Customer is the charge point operator.
- The CCS2 cable enclosure must NOT be opened and DC must NOT be tapped (avoids a new regulatory process).
  Inductive harvesting from the DC cable was assessed as not feasible. Hence: wireless (Qi) charging from
  the holster + an on-board battery.
- Handle rests in the holster nose horizontal, grip down. When plugged into a car it hangs at varying
  downward angles depending on car model.
- Electronics budget from earlier PRD work: roughly 5 W (plus/minus 3 W).
- Outdoor public use in Norway: rain, snow, road salt, cold (assume -25 to +40 degC ambient), drops onto
  asphalt, cable pull. Industrial designer on the team owns the outer form.
- Current prototype (V1): 3D-printed chassis with a Samsung S25. This prototype replaces the phone with a
  **Newland U200** unattended payment terminal (Android 12, IP65/IK09).
- Prototype build process: Bambu Lab H2D, FDM, PLA/PLA+ (PETG/ASA possible), printed upright, 325 mm max.

## 3. Newland U200 (datasheet)
- 111.7 x 74.6 x 35.6 mm (42.8 mm with smart-card reader), 262 g (308 g with reader).
- Power in: **7-48 V DC** via MDB slave or RS232/PULSE RJ45 port. USB-C is download-only. No battery.
- Ports: USB-A host, USB-C slave, LAN RJ45, SMA 4G antenna. Power draw NOT published (to be measured).

## 4. Wireless link (selected R0)
- QST QPR-0108 Rx: Qi 1.2.3, 5/9/12 V x 1.25 A, max 15 W, ~76 % efficient. PCBA 32x17x1.5, coil+ferrite
  50x40x1.0 (8 g). Operating 0-40 degC. Tx-Rx surface gap 3.0-4.5 mm; plastic over coil <= 2.5 mm;
  Tx coil >= 5 mm from PCB/metal. No magnet attractor.
- QST QPT-0016 Tx, 12 V in, 15 W. Bench: 230 V socket -> RS PRO 12 V 3.5 A supply -> Tx.
- Production-path coils on RS Norway: Wurth 760308102207 Rx (40x40x1.2), 760308103102 Tx (53x53x4.5).
- Rx is planned in the handle's "FIT zone" (the region of the handle that seats against the holster).

## 5. NEW REQUIREMENT (this revision)
The handle must operate for an extended period off the holster (battery integral to design).

### Coordinator's draft battery architecture (to be challenged, not accepted)
- Assumed use profile: off-holster during a charging session. Typical DC fast session 20-45 min, long
  sessions up to ~60 min, plus idle time between handling. Draft target: **>= 2 h continuous operation at
  worst-case load**, and survive a full day of back-to-back sessions with holster top-ups between them.
- Load assumption until measured: 5 W average, 8 W worst case. 2 h x 8 W = 16 Wh usable; with 80 %
  usable depth/ageing/cold derating -> ~20 Wh nominal minimum.
- Option A: **3S Li-ion** (9.0-12.6 V) feeding U200 directly through a power-path charger. Charger must
  boost, since Rx gives 12 V and 3S full is 12.6 V. Candidate: TI BQ25798 (buck-boost, 1-4S, 3.6-24 V in,
  NVDC power path, JEITA NTC). E.g. 3S1P of 18650 cells at ~3000 mAh (~10.8 Wh each) = ~32 Wh, ~140 g.
- Option B: **2S Li-ion** (6.0-8.4 V) + boost to 12 V for U200 (2S dips below 7 V minimum, so a boost is
  mandatory), buck charger from 12 V. Extra conversion stage, lower pack voltage.
- Option C: LiFePO4 (better cold/safety, lower energy density). Option D: pouch LiPo (thin, packaging
  freedom, worse abuse tolerance).
- Known risks: Li-ion must not charge below 0 degC (Norway winter, holster outdoors); Qi Rx rated only
  0-40 degC; 15 W Qi budget must cover U200 load + charging (charge time); added mass and centre of
  gravity in a hand-held, cable-loaded handle; heat from Rx + charger + U200 inside a sealed IP enclosure;
  transport/UN38.3 and IEC 62133 for later versions.

## 6. Knowledge state
- Confirmed: items in sections 2-4.
- Assumptions: use profile, 5/8 W load, -25..+40 degC, FIT zone geometry suitable for a 50x40 coil.
- Missing: U200 measured draw; FIT zone and handle outer geometry (owned by industrial designer, not in
  this packet); holster geometry; target total handle mass; IP target for the prototype.
- Unresolved: battery chemistry/config; placement of battery, Rx and U200 in the handle; back USB port role.

## 7. Revision register
| Rev | Date | Change | Checks invalidated | Rechecked |
|---|---|---|---|---|
| R0 | 2026-11-10 | No-battery bench design (doc) | - | - |
| R1 | 2026-11-10 | Battery made mandatory | All power, thermal, mass, packaging | reviews/R1-CONSOLIDATED.md |
| R2 | 2026-11-10 | Decisions 1-7 in R1-CONSOLIDATED.md adopted as design basis | Thermal and cold gates still open | pending Fusion model + Stage 1-4 tests |
