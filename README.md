# Fluid Mechanics & Hydraulics Engineering

An interactive, browser-only solver for Fluid Mechanics and Hydraulics Engineering problems, with 2D and 3D diagrams, step-by-step solutions and a printable PDF report.

American Concrete Institute Philippines T.I.P. QC Student Chapter · by CEM Jumawan

**Live site:** https://acip-tip-qc-sc.github.io/fluid-hydraulics-sim/

## Modules

- **Fluid Mechanics:** Viscosity, Pressure, Hydrostatic Forces, Analysis of Dams, Buoyancy, Relative Equilibrium
- **Hydraulics Engineering:** Orifices & Tanks, Pipe Systems, Specific Energy & Jump, Pumps & Siphons, Weirs, Open Channels, Water Hammer
- **Geotechnical Engineering** (in progress): Permeability & Seepage, Effective Stress, Stresses in Soil, Consolidation, Shear Strength, Lateral Earth Pressure & Retaining Walls

## Layout

- `index.html`: the shared header and the three discipline tabs
- `fm/`: Fluid Mechanics solver
- `hyd/`: Hydraulics Engineering solver
- `geo/`: Geotechnical Engineering solver (reuses `fm/ui.js`, `fm/iso3d.js` and `fm/styles.css`)
- `report.js`: the "Print PDF" report shared by both solvers
- `vendor/`: html2canvas 1.4.1 and jsPDF 2.5.1 (MIT licensed), hosted here so the PDF feature needs no outside scripts

Everything runs in the browser; there is no build step. To run it locally, serve the folder with any static server, for example `python3 -m http.server`, and open http://localhost:8000.
