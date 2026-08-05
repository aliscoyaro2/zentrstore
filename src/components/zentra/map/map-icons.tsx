import { divIcon } from "leaflet";

// Leaflet's default marker PNGs don't resolve correctly through Vite's
// asset pipeline (a long-standing, well-known issue). Using divIcon with
// inline SVG sidesteps it entirely and lets pins match Zentra's actual
// design tokens instead of Leaflet's default blue teardrop.

function pinSvg(colorVar: string) {
  return `
    <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${colorVar}"/>
      <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>
  `;
}

const iconAnchor: [number, number] = [15, 42];
const popupAnchor: [number, number] = [0, -38];

/** Amber pin — merchant / pickup location. */
export const merchantIcon = divIcon({
  className: "",
  html: pinSvg("oklch(0.769 0.166 70)"),
  iconSize: [30, 42],
  iconAnchor,
  popupAnchor,
});

/** Teal pin — customer / drop-off location. */
export const customerIcon = divIcon({
  className: "",
  html: pinSvg("oklch(0.6 0.1 183)"),
  iconSize: [30, 42],
  iconAnchor,
  popupAnchor,
});

/** Live rider marker — a small dot with a pulse ring, distinct from a static pin since it moves. */
export const riderIcon = divIcon({
  className: "",
  html: `
    <div style="position:relative;width:22px;height:22px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:oklch(0.6 0.1 183 / 0.35);animation:zentra-pulse 1.8s ease-out infinite;"></div>
      <div style="position:absolute;inset:5px;border-radius:9999px;background:oklch(0.6 0.1 183);border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
    </div>
    <style>
      @keyframes zentra-pulse {
        0% { transform: scale(0.6); opacity: 0.8; }
        100% { transform: scale(1.8); opacity: 0; }
      }
    </style>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
});