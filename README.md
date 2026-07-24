# Pausa

Juego cozy de pintura táctil, optimizado para móviles. Incluye 32 niveles,
tres dificultades, tamaños de pintura, récords por nivel, progreso local y un
creador de murales.

## Desarrollo

Requiere Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

## GitHub Pages

El proyecto incluye una compilación estática específica y un flujo automático
en `.github/workflows/deploy-pages.yml`.

1. Sube el repositorio a GitHub usando la rama `main`.
2. En **Settings → Pages**, selecciona **GitHub Actions** como fuente.
3. Ejecuta el flujo **Deploy Pausa to GitHub Pages** o haz un push a `main`.

La compilación utiliza rutas relativas, por lo que funciona tanto en un dominio
`usuario.github.io` como en `usuario.github.io/nombre-del-repo/`.

Para comprobar localmente la versión que se desplegará:

```bash
npm run build:pages
npm run preview:pages
```

El progreso y los niveles creados se guardan en `localStorage` del navegador.

## Otras compilaciones

- `npm run build`: comprueba la versión vinext/Sites.
- `npm run build:pages`: genera el sitio estático en `dist-pages/`.
