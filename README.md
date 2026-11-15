# Fluid Mechanics & Hydraulics Engineering

An interactive, browser-only solver for Fluid Mechanics and Hydraulics Engineering problems, with 2D and 3D diagrams, step-by-step solutions and a printable PDF report.

American Concrete Institute Philippines T.I.P. QC Student Chapter · by CEM Jumawan

**Live site:** https://engr-concrete.github.io/fluid-hydraulics-sim/

## Modules

- **Fluid Mechanics:** Viscosity, Pressure, Hydrostatic Forces, Analysis of Dams, Buoyancy, Relative Equilibrium
- **Hydraulics Engineering:** Orifices & Tanks, Pipe Systems, Specific Energy & Jump, Pumps & Siphons, Weirs, Open Channels, Water Hammer

## Layout

- `index.html`: the shared header and the two discipline tabs
- `fm/`: Fluid Mechanics solver
- `hyd/`: Hydraulics Engineering solver
- `report.js`: the "Print PDF" report shared by both solvers
- `vendor/`: html2canvas 1.4.1 and jsPDF 2.5.1 (MIT licensed), hosted here so the PDF feature needs no outside scripts

Everything runs in the browser; there is no build step. To run it locally, serve the folder with any static server, for example `python3 -m http.server`, and open http://localhost:8000.
