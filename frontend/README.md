# Quasar App (frontend)

A Quasar Project

## Roles / sample logins

The app routes users by role after login (see `src/router/index.ts`, backed by `backend/`):

| Role | Login | Landing page |
|---|---|---|
| Member | `1100000000001` / `Member123!` | `/dashboard` |
| Admin | `admin` / `Admin123!` | `/admin` |
| Municipality Officer (read-only monitoring) | `municipality01` / `Municipality123!` | `/municipality` |

Municipality pages (`/municipality`, `/municipality/members`, `/municipality/members/:id`,
`/municipality/operations`, `/municipality/fund`, `/municipality/reports`) are guarded by the
`municipality` role and are read-only - see `backend/README.md` ("Municipality role") for the API
endpoints behind them.

## Install the dependencies

```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

### Lint the files

```bash
yarn lint
# or
npm run lint
```

### Format the files

```bash
yarn format
# or
npm run format
```

### Build the app for production

```bash
quasar build
```

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
