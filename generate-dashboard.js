// generate-dashboard.js
const fs = require("fs");

const data = JSON.parse(fs.readFileSync("stats.json", "utf8"));

const WIDTH = 1600;
const HEIGHT = 800;

const BIG_RADIUS = 295;
const SMALL_RADIUS = 215;
const SPACING = 60;

const centerY = 420;
const centerX = WIDTH / 2;

const leftX = centerX - (BIG_RADIUS + SMALL_RADIUS + SPACING);
const rightX = centerX + (BIG_RADIUS + SMALL_RADIUS + SPACING);

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);

  const diff = endAngle - startAngle;
  const largeArcFlag = Math.abs(diff) <= 180 ? "0" : "1";
  const sweepFlag = diff >= 0 ? "1" : "0";

  return `M ${start.x} ${start.y}
          A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

function buildGauge(cx, cy, radius, value, maxValue, title, unit, isPercent=false, isBig=false) {

  value = clamp(value, 0, maxValue);

  const zeroAngle = -120;
  const maxAngle = 120;
  const totalAngle = maxAngle - zeroAngle;
  const ratio = value / maxValue;
  const targetAngle = zeroAngle + ratio * totalAngle;

  let ticks = "";
  let numbers = "";

  const outerTickRadius = radius - 35;
  const innerMajor = radius - 75;
  const innerMinor = radius - 60;

  for (let i = 0; i <= maxValue; i++) {

    const angle = zeroAngle + (i / maxValue) * totalAngle;
    const major = i % (isPercent ? 10 : 5) === 0;

    const outer = polar(cx, cy, outerTickRadius, angle);
    const inner = polar(cx, cy, major ? innerMajor : innerMinor, angle);

    ticks += `
      <line x1="${outer.x}" y1="${outer.y}"
            x2="${inner.x}" y2="${inner.y}"
            stroke="white"
            stroke-width="${major ? 3 : 1.5}"
            stroke-linecap="round"
            shape-rendering="crispEdges"/>`;

    if (major) {
      const numPos = polar(cx, cy, radius - 110, angle);
      numbers += `
        <text x="${numPos.x}" y="${numPos.y}"
              fill="url(#fire)"
              font-size="${isBig ? 26 : 18}"
              text-anchor="middle"
              dominant-baseline="middle"
              filter="url(#glow)">
              ${i}
        </text>`;
    }
  }

  const arcRadius = radius - 18;
  const fullArc = describeArc(cx, cy, arcRadius, zeroAngle, maxAngle);
  const arcLength = Math.PI * arcRadius * (240 / 180);
  const dashOffset = arcLength * (1 - ratio);

  const needleLength = radius - 90;
  const needleTip = polar(cx, cy, needleLength, 0);

  const lcdWidth = isPercent ? 170 : (isBig ? 180 : 150);
  const lcdHeight = isPercent ? 55 : (isBig ? 55 : 48);
  const lcdY = cy + radius - 85;

  const lcdText = isPercent
    ? `${value}% COMMITS`
    : `${value} ${unit}`;

  return `
  <circle cx="${cx}" cy="${cy}" r="${radius + 18}" fill="url(#metal)"/>
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#dial)"/>

  <path d="${fullArc}"
        stroke="url(#fire)"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
        filter="url(#glow)"
        stroke-dasharray="${arcLength}"
        stroke-dashoffset="${arcLength}">
    <animate attributeName="stroke-dashoffset"
             from="${arcLength}"
             to="${dashOffset}"
             dur="1s"
             fill="freeze"/>
  </path>

  ${ticks}
  ${numbers}

  <polygon points="
      ${cx - 5},${cy}
      ${cx + 5},${cy}
      ${needleTip.x},${needleTip.y}"
      fill="url(#fire)"
      transform="rotate(${zeroAngle} ${cx} ${cy})"
      filter="url(#glow)">
    <animateTransform
      attributeName="transform"
      type="rotate"
      from="${zeroAngle} ${cx} ${cy}"
      to="${targetAngle} ${cx} ${cy}"
      dur="1s"
      fill="freeze"/>
  </polygon>

  <circle cx="${cx}" cy="${cy}" r="10" fill="white"/>

  <ellipse cx="${cx}" cy="${cy - radius * 0.32}"
           rx="${radius * 0.65}"
           ry="${radius * 0.25}"
           fill="white"
           opacity="0.05"/>

  <text x="${cx}" y="${cy - radius * 0.32}"
        text-anchor="middle"
        fill="url(#fire)"
        font-size="${isBig ? 28 : 20}"
        font-weight="bold"
        letter-spacing="2"
        filter="url(#glow)">
    ${title}
  </text>

  <rect x="${cx - lcdWidth/2}" y="${lcdY}"
        width="${lcdWidth}"
        height="${lcdHeight}"
        rx="10"
        fill="#1b3a0f"/>

  <text x="${cx}" y="${lcdY + lcdHeight/2 + 2}"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="#9CFF00"
        font-size="${isBig ? 20 : 18}"
        letter-spacing="2">
    ${lcdText}
  </text>
  `;
}

const svg = `
<svg 
     width="100%"
     viewBox="0 0 ${WIDTH} ${HEIGHT}"
     preserveAspectRatio="xMidYMid meet"
     xmlns="http://www.w3.org/2000/svg"
     shape-rendering="geometricPrecision"
     text-rendering="geometricPrecision">

  <defs>

    <radialGradient id="metal">
      <stop offset="0%" stop-color="#bbb"/>
      <stop offset="50%" stop-color="#444"/>
      <stop offset="100%" stop-color="#aaa"/>
    </radialGradient>

    <radialGradient id="dial">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#000"/>
    </radialGradient>

    <linearGradient id="fire" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff0000"/>
      <stop offset="50%" stop-color="#ff6600"/>
      <stop offset="100%" stop-color="#ffff00"/>
    </linearGradient>

    <filter id="glow">
      <feGaussianBlur stdDeviation="1.2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

  </defs>

  ${buildGauge(leftX, centerY, SMALL_RADIUS, data.commitPercent, 100, "PERCENT", "%", true)}
  ${buildGauge(centerX, centerY, BIG_RADIUS, data.currentStreak, 30, "DAYS", "DAYS", false, true)}
  ${buildGauge(rightX, centerY, SMALL_RADIUS, data.longestStreak, 30, "DAYS", "DAYS", false)}

</svg>
`;

fs.writeFileSync("dashboard.svg", svg);
console.log("✅ dashboard-v2.svg updated");
