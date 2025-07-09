# Étape 1: Builder - Installation des dépendances et build de l'application
FROM node:20-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json pnpm-lock.yaml ./

# Installer les dépendances avec pnpm
# Note: Nous avons besoin d'installer pnpm d'abord
RUN npm install -g pnpm
RUN pnpm install

# Copier le reste du code de l'application
COPY . .

# Construire l'application
RUN pnpm build


# Étape 2: Runner - Exécution de l'application
FROM node:20-alpine AS runner

WORKDIR /app

# Créer un utilisateur non-root pour l'exécution
RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers du build depuis l'étape 'builder'
# Grâce à 'output: standalone', tout ce dont nous avons besoin est ici
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public

# Définir les permissions avant de changer d'utilisateur
RUN chown -R nextjs:nextjs .

# Changer d'utilisateur
USER nextjs

# Exposer le port sur lequel l'application tourne
EXPOSE 3000

# Définir les variables d'environnement (optionnel, mais bonne pratique)
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Commande pour démarrer l'application
CMD ["node", "server.js"]