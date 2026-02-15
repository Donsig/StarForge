/** Base production per hour with no mines (free trickle) */
export const BASE_PRODUCTION = {
  metal: 30,
  crystal: 15,
  deuterium: 0,
} as const;

/** Default storage capacity with no storage buildings */
export const BASE_STORAGE = {
  metal: 10000,
  crystal: 10000,
  deuterium: 10000,
} as const;
