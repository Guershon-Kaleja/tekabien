# TekaBien — Contexte Projet Complet

## IDENTITÉ
- **Nom** : TekaBien
- **Slogan** : "Fini le cahier, place au digital"
- **Type** : PWA SaaS pour micro-entrepreneurs à Kinshasa, RDC
- **Couleurs** : Bleu #1A56DB, Or #F5A623, Fond #EEF2F7

---

## STACK TECHNIQUE
- **Frontend** : React + Vite + Tailwind CSS + Recharts + jsPDF + vite-plugin-pwa
- **Backend** : Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Hébergement** : Vercel (3 projets séparés)
- **Paiements** : Labyrinthe API V1 — `https://api.labyrinthe-rdc.com/api/V1`

---

## REPOS GITHUB
- **App PWA** : https://github.com/Guershon-Kaleja/tekabien (public)
- **Admin** : https://github.com/Guershon-Kaleja/tekabien-admin (privé)
- **Landing** : https://github.com/Guershon-Kaleja/tekabien-landing (privé)

## URLS DE DÉPLOIEMENT
- **App** : https://tekabien.vercel.app
- **Admin** : https://tekabien-admin.vercel.app
- **Landing** : https://tekabien-landing.vercel.app

---

## SUPABASE
- **Projet ID** : qoeextvpjhgqjrnzwkcj
- **URL** : https://qoeextvpjhgqjrnzwkcj.supabase.co

### Tables
| Table | Description |
|-------|-------------|
| users | id, shop_name, email, phone, plan, plan_expires, currency, role |
| products | id, user_id, name, price_sell, price_buy, quantity, alert_threshold, category |
| sales | id, user_id, product_id, product_name, quantity, total, cost, payment_method, customer_id, customer_name, encaissee, due_date |
| customers | id, user_id, name, total_debt, total_paid |
| debts | id, user_id, customer_id, amount, paid, status, note, due_date |
| debt_payments | id, user_id, customer_id, amount, note, created_at |
| expenses | id, user_id, category, amount, note, created_at |
| payments | id, user_id, reference, order_number, plan, amount, currency, duration, status |
| audit_logs | id, admin_id, action, created_at |

### Edge Functions déployées (--no-verify-jwt)
| Fonction | Description |
|----------|-------------|
| labyrinthe-payment | Initier un paiement Mobile Money |
| payment-callback | Webhook Labyrinthe → activation plan |
| get-users | Admin — liste des utilisateurs |
| admin-action | Admin — activer/désactiver plan |
| phone-login | Connexion par numéro de téléphone |

### Secrets Supabase
- `LABYRINTHE_TOKEN` — token API Labyrinthe (mode test actuellement)
- `WEBHOOK_SECRET` — tekabien_webhook_2025_secret
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## VARIABLES D'ENVIRONNEMENT APP
```
VITE_SUPABASE_URL=https://qoeextvpjhgqjrnzwkcj.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## STRUCTURE DU PROJET APP
```
src/
├── components/
│   ├── Navbar.jsx          — Navigation bas de page
│   └── Header.jsx          — Header bleu avec titre
├── context/
│   └── UserContext.jsx     — Context global (userId, userPlan, currency, shopName, role)
├── hooks/
│   ├── usePlanCheck.js     — Vérification plan à chaque page
│   └── useCurrency.js      — Formatage montants FC/USD
├── lib/
│   ├── supabase.js         — Client Supabase
│   ├── labyrinthe.js       — Initier paiement Mobile Money
│   ├── validation.js       — Validation + sanitize() inputs
│   └── planLimits.js       — Limites par plan
├── pages/
│   ├── Dashboard.jsx       — Accueil + stats du jour
│   ├── Ventes.jsx          — Nouvelle vente + historique
│   ├── Stocks.jsx          — Gestion produits
│   ├── Clients.jsx         — Clients + dettes
│   ├── Depenses.jsx        — Dépenses + trésorerie
│   ├── Rapports.jsx        — Rapports + export PDF
│   ├── Profil.jsx          — Profil + abonnement + paiements
│   ├── Login.jsx           — Connexion + inscription
│   ├── Onboarding.jsx      — Écran bienvenue après inscription
│   ├── Expired.jsx         — Paiement Pro
│   └── ResetPassword.jsx   — Réinitialisation mot de passe
└── main.jsx
```

---

## MODÈLE DE REVENUS
| Plan | Prix affiché | Prélevé | Labyrinthe 7% |
|------|-------------|---------|---------------|
| Gratuit | 0$ | 0 FC | - |
| Pro | 5$ / 12000 FC | 4.67$ / 11215 FC | 0.33$ / 785 FC |

### Réductions multi-mois
| Durée | Réduction | Prix USD | Prix FC |
|-------|-----------|----------|---------|
| 1 mois | 0% | 5$ | 12 000 FC |
| 3 mois | -10% | 13.50$ | 32 400 FC |
| 6 mois | -15% | 25.50$ | 61 200 FC |
| 12 mois | -20% | 48$ | 115 200 FC |

### PLAN_PRICES côté serveur (labyrinthe-payment)
```typescript
const PLAN_PRICES = {
  pro: {
    USD: { 1: 4.67, 3: 12.61, 6: 23.82, 12: 44.83 },
    CDF: { 1: 11215, 3: 30281, 6: 57197, 12: 107664 },
  },
}
```

---

## PLANS ET LIMITES
```js
free:  { maxSalesPerDay: 10, maxProducts: 5, maxClients: 3, canExportPDF: false, canViewReports: false }
trial: { maxSalesPerDay: Infinity, maxProducts: Infinity, maxClients: Infinity, canExportPDF: true, canViewReports: true }
pro:   { maxSalesPerDay: Infinity, maxProducts: Infinity, maxClients: Infinity, canExportPDF: true, canViewReports: true }
```

### Essai gratuit
- **14 jours** après inscription
- Après expiration + grâce 3 jours → passage automatique en free
- Plan `disabled` → redirection /expired immédiate

---

## FONCTIONNALITÉS IMPLÉMENTÉES ✅

### Authentication
- Inscription avec email (requis) + téléphone (optionnel)
- Connexion email OU numéro de téléphone
- Session persistante (persistSession: true, autoRefreshToken: true)
- Rate limiting connexion : 5 tentatives / 2 minutes
- Reset password par email

### Dashboard
- Stats du jour (ventes, bénéfice net, dettes, stocks bas)
- Bandeau plan (trial/pro/free) avec alertes expiration
- Alerte "Pro expire bientôt" quand ≤ 3 jours restants
- Passage automatique en free après expiration

### Ventes
- Nouvelle vente avec sélection produit + quantité + mode paiement
- Ventes crédit (non comptabilisées jusqu'au remboursement)
- Historique avec filtres (aujourd'hui, 7j, mois, date custom)
- Annulation vente avec restitution stock

### Stocks
- Ajout/modification/suppression produit
- Réapprovisionnement stock
- Filtres (tous, stock bas)
- Alertes stock bas

### Clients & Dettes
- Ajout/modification/suppression client
- Ajout dette manuelle + date d'échéance (due_date)
- Paiement partiel / total remboursement
- Historique remboursements
- Vente crédit avec date d'échéance

### Dépenses
- Ajout/modification/suppression dépense
- 10 catégories (marchandises, transport, loyer, etc.)
- Filtres date (aujourd'hui, 7j, mois, date custom)
- Bénéfice net = ventes encaissées - coût achat - dépenses

### Rapports
- Graphiques (BarChart ventes, PieChart modes paiement)
- Top produits par marge
- Export PDF (Pro uniquement)
- Filtres date (aujourd'hui, 7j, mois, date custom)

### Profil (4 onglets)
- **Profil** : nom activité, téléphone, devise (FC/USD)
- **Sécurité** : changement mot de passe
- **Abonnement** : plan actuel, comparaison plans, bouton passer Pro
- **Paiements** : historique paiements completed avec montants réels

### Paiement Labyrinthe
- Initiation paiement Mobile Money (Airtel, Orange, M-Pesa)
- Webhook activation automatique plan
- Polling 3s pour confirmation
- Multi-mois avec réductions
- Montants calculés côté serveur

### PWA
- Installable sur Android et iOS
- Manifest, service worker, icônes 144/192/512px
- Mode online uniquement (pas de offline)

---

## SÉCURITÉ ✅
- RLS activé sur toutes les tables Supabase
- Service Role Key uniquement en Edge Functions
- JWT tokens + persistSession
- Montants paiement calculés côté serveur
- Rate limiting : connexion (5/2min), paiements (3/10min)
- Webhook sécurisé par WEBHOOK_SECRET
- CORS configuré sur toutes les Edge Functions
- Validation téléphone côté serveur
- Validation UUID userId dans admin-action
- Validation inputs admin-action (plan, durée, action)
- Select explicite dans get-users (pas select *)
- CSP dans index.html
- sanitize() sur tous les inputs
- Admin robots.txt noindex + meta noindex
- RLS users_phone_lookup corrigée (auth.uid() = id uniquement)

### CORS par Edge Function
| Fonction | Origine autorisée |
|----------|-------------------|
| labyrinthe-payment | https://tekabien.vercel.app |
| payment-callback | * (appelé par Labyrinthe) |
| get-users | https://tekabien-admin.vercel.app |
| admin-action | https://tekabien-admin.vercel.app |
| phone-login | https://tekabien.vercel.app |

---

## OPTIMISATIONS PERFORMANCE ✅
- **Promise.all** sur toutes les pages (requêtes parallèles)
- **UserContext** — userId, userPlan, currency, shopName chargés une seule fois
- **Optimistic UI** — Stocks, Clients, Dépenses, Ventes (mise à jour locale immédiate)
- **Lazy loading** pages dans App.jsx
- **useCurrency** depuis UserContext (plus de requête réseau)
- **usePlanCheck** depuis UserContext (plus de requête réseau)
- Changement devise instantané via UserContext

---

## ADMIN SÉPARÉ (tekabien-admin.vercel.app)
- Login avec email admin@tekabien.com
- Stats : total users, nouveaux/semaine, essai, pro, gratuit, taux conversion
- Revenus réels ce mois (USD + CDF)
- Recherche par nom/email, filtres par plan
- Actions : activer Pro 1/3/6/12 mois, remettre en essai (14j fixe), passer en gratuit
- PWA installable
- robots.txt + meta noindex (invisible des moteurs de recherche)

---

## SITE VITRINE (tekabien-landing.vercel.app)
- Sections : Navbar, Hero, Features, HowItWorks, Pricing, Testimonials, FAQ, Download, Footer
- Pages : / , /privacy, /terms
- SEO : meta tags, sitemap.xml, robots.txt, schema.org, geo.region CD
- Stack : React + Vite + Tailwind (pas de PWA)
- Responsive : PC, tablette, mobile

---

## COMPTES DE TEST
| Shop | Plan | Email |
|------|------|-------|
| vente de meche | trial | kalejashon@gmail.com |
| Admin TekaBien | admin | admin@tekabien.com |

---

## CE QUI RESTE À FAIRE

### 🔴 Avant lancement
1. Acheter tekabien.com (~$6.79 Namecheap avec code NEWCOM679)
2. Configurer DNS Namecheap (A @ → 76.76.21.21, CNAME app/admin → cname.vercel-dns.com)
3. Ajouter domaines sur Vercel
4. Mettre à jour CORS → app.tekabien.com
5. Mettre à jour Supabase URLs → app.tekabien.com
6. Contacter Labyrinthe pour mode production
7. Changer LABYRINTHE_TOKEN production dans Supabase secrets
8. Mettre à jour URLs dans le code (sitemap, canonical, Footer, Download)
9. Configurer emails forwarder Namecheap + SMTP Resend.com

### 📱 Capacitor (V1 prévue)
10. Intégrer Capacitor → app native Android + iOS
11. Notifications push natives :
    - Stock bas
    - Rappel dette (due_date déjà stocké en DB)
    - Expiration plan
    - Confirmation paiement
    - Résumé quotidien
12. Compte Google Play (25$) + publication
13. Compte App Store + publication

### 🌍 Site vitrine
14. Remplacer faux chiffres (500+, 4.8/5)
15. Remplacer faux témoignages
16. Prix FC en priorité (12 000 FC)
17. Screenshots réels de l'app
18. Lien Google Play réel
19. Google Analytics + Search Console

### 🔒 Sécurité V2
20. 2FA pour admin
21. DOMPurify
22. Rotation secrets périodique
23. Backup Supabase Pro

---

## BUGS CONNUS
- Flash bleu au réveil de l'app (PWA) → sera résolu avec Capacitor
- Aucun autre bug connu

---

## ARCHITECTURE DÉCISIONS IMPORTANTES
- **Online uniquement** — pas de mode offline (données toujours fraîches)
- **UserContext** — source unique de vérité pour userId, userPlan, currency
- **Optimistic UI** — mise à jour locale immédiate + rollback si erreur Supabase
- **Devise** — FC par défaut, USD disponible, changement instantané via Context
- **Ventes crédit** — non comptabilisées dans le bénéfice jusqu'au remboursement
- **Suppression compte** — données supprimées mais payments anonymisés (user_id = null)