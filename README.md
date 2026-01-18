# TL Raid Manager

Application web pour gerer la guilde et les raids de Throne and Liberty.

## Fonctionnalites

- gestion des raids et planning
- gestion des membres et roles
- gestion du loot, points et statistiques
- interface PWA (installable)

## Prerequis

- Node.js 18+
- npm (ou pnpm / yarn)

## Demarrer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000

## Scripts utiles

```bash
npm run dev
npm run build
npm run start
```

## PWA

Le manifest est dans `public/manifest.json`. Pense a placer les icones :
- `public/icon-192x192.png`
- `public/icon-512x512.png`

## Deploy

Tu peux deployer sur Vercel ou tout autre hebergeur Node.
