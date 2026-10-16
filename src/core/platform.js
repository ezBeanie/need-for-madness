// What the game adapts to, detected once at start.

const agent = navigator.userAgent;

export const isIos = /iPhone|iPad|iPod/i.test(agent);

// Phones and tablets get touch controls and fewer instruction images.
export const isPhone =
  /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(agent) ||
  "ontouchstart" in document.documentElement;

export const isFirefox = agent.toLowerCase().includes("firefox");

// Interface images come in two resolutions: data/interface1 and data/interface2 (small screens).
export const interfaceResolution = screen.width <= 680 ? 2 : 1;
