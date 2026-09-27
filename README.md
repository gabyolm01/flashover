# Flashover

Plateforme de révision des futurs chefs d'équipe sapeurs-pompiers : fiches de révision et jeux en équipe, par module.

- Site statique (HTML, CSS, JavaScript, sans étape de compilation), hébergé sur GitHub Pages.
- Contenu (fiches, questions, réglages) stocké dans Supabase, accessible uniquement avec un code d'accès.
- Mode formateur protégé par un second code, pour modifier le contenu en ligne.
- Progression des stagiaires enregistrée sur leur appareil uniquement (aucun compte, aucune donnée personnelle).

## Organisation

| Dossier | Contenu |
|---|---|
| `index.html`, `css/`, `js/` | Le site |
| `js/games/` | Quiz, duel d'équipes, tableau à étiquettes |
| `js/revision/` | Affichage des fiches et tests |
| `js/formateur/` | Mode formateur |
| `supabase/setup.sql` | Création de la base (à lancer une fois) |
| `tools/` | Outils : serveur local, génération du contenu de départ |
| `seed/` | Sources du contenu (**non publiées**, voir `.gitignore`) |

## Tester sur l'ordinateur

```
node tools/build-seed.js
node tools/serve.js
```

Puis ouvrir http://localhost:8765. Tant que `js/config.js` est vide, le site fonctionne en **mode local** : codes `stagiaire` et `formateur`, modifications gardées dans le navigateur.

## Mise en ligne

Voir [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md).
