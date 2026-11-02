# Need for Madness

Need for Madness in the browser, with a stage editor and multiplayer races.

## Start the game

You need [Node.js](https://nodejs.org/) 18 or newer.

```sh
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

To play with other devices in the same network (multiplayer), start it with `npm run dev -- --host` and open the network address it prints on those devices.

## Build

```sh
npm run build    # the finished game in dist/
npm run preview  # serves dist/ locally
```

## Tests

```sh
npm test             # unit tests
npm run test:visual  # browser tests (Playwright)
npm run lint
```
