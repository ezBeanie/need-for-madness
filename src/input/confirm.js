// Enter, Escape (and the handbrake outside races) confirm in the menus. One press confirms
// once: it stays pressed until a screen uses it, then counts as used until released.
export const CONFIRM = { released: 0, pressed: 1, used: 2 };

export const confirm = { state: CONFIRM.released };

export const pressConfirm = (pressed) => {
  if (pressed && confirm.state == CONFIRM.released) {
    confirm.state = CONFIRM.pressed;
  }
  if (!pressed && confirm.state != CONFIRM.released) {
    confirm.state = CONFIRM.released;
  }
};
