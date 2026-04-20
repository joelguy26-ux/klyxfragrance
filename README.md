# Klyx Fragrances — Web Programming Assignment (HTML, CSS, JavaScript)

Luxury fragrance e-commerce demo with **vanilla JavaScript** and **localStorage** (no frameworks).

## How to run

1. Clone or download this folder.
2. Open the site in **Google Chrome** (recommended for grading):
   - **Option A:** Double-click `index.html` (login page), or  
   - **Option B:** From this folder run a local static server, for example:  
     `npx --yes serve`  
     then open the URL shown (e.g. `http://localhost:3000`).
3. Ensure the `images/` folder and product assets exist next to the HTML files (logo and bottle images).

**Entry flow:** `index.html` → log in → `home.html` (shop). Register first if you have no account.

## Login credentials

There are **no default credentials**. You must **register** once on `register.html`, then sign in on `index.html` with:

- **TRN:** the value you registered (format `000-000-000`)
- **Password:** the password you chose (minimum 8 characters)

To start over, in Chrome open **DevTools → Application → Local Storage** and clear keys for your origin (`RegistrationData`, `AllProducts`, `AllInvoices`, etc.), or use a private window.

## Tools used

- HTML5  
- CSS3 (including Flexbox and Grid, media queries)  
- JavaScript (ES5-style syntax for broad browser compatibility)  
- Browser APIs: `localStorage`, `sessionStorage`, `JSON.stringify` / `JSON.parse`, DOM APIs  

## Key files

| File | Role |
|------|------|
| `js/script.js` | Registration, login (3 attempts + lockout), reset password, products, cart, checkout, invoices, analytics |
| `css/styles.css` | Layout and theme |
| `index.html` | Login |
| `home.html` | Product catalogue (rendered by JS) |
| `register.html` | New account |
| `cart.html`, `checkout.html`, `invoice.html` | Cart → checkout → receipt |
| `about.html` | Author info + **ShowUserFrequency** charts + **ShowInvoices** table |
| `lockout.html` | Shown after too many failed logins |

## localStorage keys

- `RegistrationData` — array of user objects (each includes `cart` and `invoices[]`).  
- `AllProducts` — product catalogue array (seeded on first load if empty).  
- `AllInvoices` — every invoice generated at checkout.  

`sessionStorage` holds the current session TRN and the last invoice view for `invoice.html` after checkout.

## Console helpers (optional)

With DevTools → Console open on `about.html` (or any page that loaded `script.js`):

- `ShowUserFrequency()` — gender + age band counts (also logged).  
- `ShowInvoices()` / `ShowInvoices('000-000-000')` — invoice list.  
- `GetUserInvoices('000-000-000')` — returns an array for that TRN.  

---

© 2026 Klyx Fragrances (student project).
