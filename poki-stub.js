// Offline-Ersatz für das Poki-SDK: Werbepausen werden sofort übersprungen, Rewards immer gewährt.
window.PokiSDK = {
  init: () => Promise.resolve(),
  gameLoadingFinished: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  commercialBreak: () => Promise.resolve(),
  rewardedBreak: () => Promise.resolve(true),
};
