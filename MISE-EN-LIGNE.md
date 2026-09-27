# Mettre Flashover en ligne

Deux services gratuits : **Supabase** (la base de données qui garde le contenu) et **GitHub Pages** (l'hébergement du site).
Comptez 20 minutes environ. Aucune carte bancaire n'est demandée.

---

## Partie A — La base de données (Supabase)

1. Allez sur **https://supabase.com** et cliquez sur **Start your project**.
   Choisissez **Continue with GitHub** : vous utilisez votre compte GitHub, pas de nouveau mot de passe.
2. Cliquez sur **New project** et remplissez :
   - **Name** : `flashover`
   - **Database Password** : cliquez sur *Generate a password* et notez-le en lieu sûr (il ne servira normalement plus).
   - **Region** : *West EU (Paris)*
   - Laissez le plan **Free**, puis **Create new project**.
3. Attendez 1 à 2 minutes que le projet soit prêt.
4. **Choisissez vos deux codes** :
   - le **code stagiaire** (donné aux stagiaires, par exemple `CE-2026`) ;
   - le **code formateur** (secret, pour modifier le contenu), différent du premier.
   Au moins 4 caractères chacun. Ils pourront être changés plus tard depuis le mode formateur.
5. Dans le menu de gauche, ouvrez **SQL Editor**, puis **New query**.
   Ouvrez le fichier `supabase/setup.sql` du dossier Flashover, copiez tout son contenu et collez-le.
   **Tout en bas**, remplacez `CODE-STAGIAIRE` et `CODE-FORMATEUR` par vos deux codes (gardez les apostrophes).
   Cliquez sur **Run**. Le message attendu est *Success. No rows returned*.
6. Toujours dans **SQL Editor**, faites **New query**, collez le contenu du fichier `supabase/seed.sql`
   (c'est le contenu des fiches et des questions), puis **Run**.
7. Allez dans **Project Settings** (roue crantée) > **API Keys** et copiez :
   - l'adresse du projet (**Project URL**, du type `https://xxxx.supabase.co`, visible aussi dans *Data API*) ;
   - la clé publique (**Publishable key** `sb_publishable_…`, ou dans l'onglet *Legacy* la clé **anon public**).
   Ces deux valeurs ne sont pas secrètes : elles ne donnent accès à rien sans les codes.
   **Envoyez-les à Claude**, qui les placera dans `js/config.js`.
   ⚠️ Ne communiquez jamais la clé **secret** / **service_role**, ni le mot de passe de la base.

## Partie B — Le site (GitHub Pages)

1. Sur **https://github.com/new**, créez un dépôt :
   - **Repository name** : `flashover`
   - **Public** (obligatoire pour GitHub Pages gratuit ; le contenu pédagogique, lui, reste dans Supabase derrière le code)
   - ne cochez rien d'autre, puis **Create repository**.
2. Claude envoie les fichiers du site dans ce dépôt (le dossier `seed/` n'est jamais envoyé).
3. Dans le dépôt : **Settings** > **Pages** > *Build and deployment* :
   - **Source** : *Deploy from a branch*
   - **Branch** : `main`, dossier `/ (root)`, puis **Save**.
4. Après 1 à 2 minutes, l'adresse du site s'affiche en haut de cette page :
   `https://VOTRE-NOM.github.io/flashover/`
5. Onglet **Actions** : si GitHub le demande, activez les workflows. La tâche « Garder Supabase actif »
   empêche la base de se mettre en pause (les projets gratuits s'endorment après 7 jours sans visite).

## Partie C — Vérifier et partager

1. Ouvrez l'adresse sur un téléphone, entrez le code stagiaire.
2. Sur le téléphone : menu du navigateur > **Ajouter à l'écran d'accueil** pour l'avoir comme une application.
3. Testez le mode formateur (icône clé en haut à droite) avec le code formateur.
4. Partagez le lien (ou un QR code) avec les stagiaires, avec le code stagiaire.

## Bon à savoir

- **Si la base s'est endormie** (message « Impossible de charger »), connectez-vous sur supabase.com et cliquez sur *Restore project*.
- **Changer un code** : mode formateur > tableau de bord > *Codes d'accès*. Les stagiaires devront saisir le nouveau code.
- **Code formateur perdu** : dans Supabase > SQL Editor, lancez cette ligne (en remplaçant NOUVEAU-CODE) :
  `update public.flashover_codes set hash = public.flashover_hash('NOUVEAU-CODE') where role = 'formateur';`
