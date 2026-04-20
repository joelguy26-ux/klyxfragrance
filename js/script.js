/**
 * Klyx Fragrances — client-side logic (vanilla JS + localStorage)
 * Keys: RegistrationData, AllProducts, AllInvoices | Session: klyx_current_trn, klyx_login_fails, klyx_last_invoice
 */

(function () {
  "use strict";

  var LS_USERS = "RegistrationData";
  var LS_PRODUCTS = "AllProducts";
  var LS_INVOICES = "AllInvoices";
  var SS_TRN = "klyx_current_trn";
  var SS_FAILS = "klyx_login_fails";
  var SS_LAST_INV = "klyx_last_invoice";

  var DISCOUNT_RATE = 0.1;
  var TAX_RATE = 0.1;
  var COMPANY_NAME = "Klyx Fragrances";
  var MAX_LOGIN_ATTEMPTS = 3;

  // --- Generic storage helpers ---

  /** Read JSON from localStorage with fallback when missing or invalid. */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  /** Write JSON to localStorage. */
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** Escape text for safe HTML insertion. */
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Format money for display. */
  function formatMoney(n) {
    return "$" + Number(n).toFixed(2);
  }

  /** Current page id from <body data-page="..."> */
  function pageId() {
    return (document.body && document.body.getAttribute("data-page")) || "";
  }

  // --- Product catalogue ---

  /** Default catalogue matching the original static site. */
  function defaultProductList() {
    return [
      {
        id: "p-sospiro-vibrato",
        name: "Sospiro Vibrato",
        price: 198,
        description: "Opulent oriental notes; statement evening wear.",
        image: "images/sospiro-vibrato.png",
      },
      {
        id: "p-bleu-chanel",
        name: "Bleu de Chanel Parfum",
        price: 130,
        description: "Woody aromatic profile; polished and versatile.",
        image: "images/bleu-de-chanel-parfum.jpg",
      },
      {
        id: "p-valentino-roma",
        name: "Valentino Born in Roma",
        price: 95,
        description: "Modern fougère warmth with urban edge.",
        image: "images/valentino-born-in-roma.jpg",
      },
      {
        id: "p-azzaro-wanted",
        name: "Azzaro The Most Wanted",
        price: 65,
        description: "Spicy-sweet cardamom and toffee accord.",
        image: "images/azzaro-the-most-wanted.jpg",
      },
      {
        id: "p-swy-intensely",
        name: "Stronger With You Intensely",
        price: 88,
        description: "Rich vanilla and smoked chestnut for cooler nights.",
        image: "images/stronger-with-you-intensely.jpg",
      },
    ];
  }

  /** Seed AllProducts once if absent. */
  function seedProductsIfNeeded() {
    var existing = readJSON(LS_PRODUCTS, null);
    if (!existing || !Array.isArray(existing) || existing.length === 0) {
      writeJSON(LS_PRODUCTS, defaultProductList());
    }
  }

  /** Return product array from localStorage. */
  function getAllProducts() {
    return readJSON(LS_PRODUCTS, defaultProductList());
  }

  /** Find one product by id. */
  function findProductById(id) {
    var list = getAllProducts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  // --- User / registration ---

  /** All registered users. */
  function getRegistrationData() {
    var u = readJSON(LS_USERS, []);
    return Array.isArray(u) ? u : [];
  }

  /** Persist full user array. */
  function saveRegistrationData(users) {
    writeJSON(LS_USERS, users);
  }

  /** Find user index by TRN (normalized). */
  function findUserIndexByTrn(trn) {
    var t = normalizeTrn(trn);
    var users = getRegistrationData();
    for (var i = 0; i < users.length; i++) {
      if (normalizeTrn(users[i].trn) === t) return i;
    }
    return -1;
  }

  /** Return user object or null. */
  function findUserByTrn(trn) {
    var i = findUserIndexByTrn(trn);
    if (i === -1) return null;
    return getRegistrationData()[i];
  }

  /** Normalize TRN string for comparison. */
  function normalizeTrn(trn) {
    return String(trn || "").trim();
  }

  /**
   * TRN must be exactly 11 characters: 3 digits, dash, 3 digits, dash, 3 digits (numbers only).
   * Enforces length, dash positions, and numeric segments.
   */
  function isValidTrnFormat(trn) {
    var t = normalizeTrn(trn);
    if (t.length !== 11) return false;
    return /^\d{3}-\d{3}-\d{3}$/.test(t);
  }

  /** Ensure cart object has lines array. */
  function normalizeCart(cart) {
    if (!cart || typeof cart !== "object") return { lines: [] };
    if (!Array.isArray(cart.lines)) cart.lines = [];
    return cart;
  }

  /** Merge user back into RegistrationData at index. */
  function updateUserAt(index, user) {
    var users = getRegistrationData();
    if (index < 0 || index >= users.length) return;
    users[index] = user;
    saveRegistrationData(users);
  }

  /** Logged-in TRN (session). */
  function getSessionTrn() {
    return sessionStorage.getItem(SS_TRN);
  }

  /** Set session TRN after login. */
  function setSessionTrn(trn) {
    sessionStorage.setItem(SS_TRN, normalizeTrn(trn));
  }

  /** Clear session (optional use). */
  function clearSession() {
    sessionStorage.removeItem(SS_TRN);
  }

  /** Current user from session or null. */
  function getCurrentUser() {
    var trn = getSessionTrn();
    if (!trn) return null;
    return findUserByTrn(trn);
  }

  /** Current user index. */
  function getCurrentUserIndex() {
    var trn = getSessionTrn();
    if (!trn) return -1;
    return findUserIndexByTrn(trn);
  }

  /** Redirect to login if not authenticated. */
  function requireAuth() {
    if (!getSessionTrn()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  /** Age in full years from YYYY-MM-DD. */
  function ageFromDob(dobStr) {
    var parts = String(dobStr).split("-");
    if (parts.length !== 3) return 0;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var birth = new Date(y, m, d);
    var now = new Date();
    var age = now.getFullYear() - birth.getFullYear();
    var md = now.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  /** Login failure counts per TRN in sessionStorage (not localStorage). */
  function getFailMap() {
    try {
      var raw = sessionStorage.getItem(SS_FAILS);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function setFailMap(map) {
    sessionStorage.setItem(SS_FAILS, JSON.stringify(map));
  }

  function getFailCount(trn) {
    var m = getFailMap();
    var k = normalizeTrn(trn);
    return m[k] || 0;
  }

  function incrementFailCount(trn) {
    var m = getFailMap();
    var k = normalizeTrn(trn);
    m[k] = (m[k] || 0) + 1;
    setFailMap(m);
    return m[k];
  }

  function clearFailCount(trn) {
    var m = getFailMap();
    var k = normalizeTrn(trn);
    delete m[k];
    setFailMap(m);
  }

  // --- Cart math ---

  /** Compute subtotal from line items (unitPrice * qty). */
  function merchandiseSubtotal(lines) {
    var s = 0;
    for (var i = 0; i < lines.length; i++) {
      s += Number(lines[i].unitPrice) * Number(lines[i].quantity);
    }
    return s;
  }

  /**
   * Apply 10% merchandise discount and 10% tax on discounted amount.
   * Returns { subtotal, discount, tax, total }
   */
  function computeCartTotals(lines) {
    var subtotal = merchandiseSubtotal(lines);
    var discount = subtotal * DISCOUNT_RATE;
    var afterDisc = subtotal - discount;
    var tax = afterDisc * TAX_RATE;
    var total = afterDisc + tax;
    return {
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: total,
    };
  }

  /** Read cart lines for session user. */
  function getCartLines() {
    var u = getCurrentUser();
    if (!u) return [];
    var cart = normalizeCart(u.cart);
    return cart.lines.slice();
  }

  /** Save cart lines for session user. */
  function saveCartLines(lines) {
    var idx = getCurrentUserIndex();
    if (idx === -1) return;
    var users = getRegistrationData();
    var user = users[idx];
    user.cart = normalizeCart(user.cart);
    user.cart.lines = lines;
    updateUserAt(idx, user);
  }

  /** Add or merge line for product id. */
  function addProductToCart(productId) {
    if (!requireAuth()) return;
    var p = findProductById(productId);
    if (!p) return;
    var lines = getCartLines();
    var found = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].productId === p.id) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      lines[found].quantity = Number(lines[found].quantity) + 1;
    } else {
      lines.push({
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: 1,
      });
    }
    saveCartLines(lines);
  }

  /** Update quantity for one line; remove if qty < 1. */
  function updateLineQuantity(productId, qty) {
    var q = parseInt(qty, 10);
    var lines = getCartLines();
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].productId !== productId) {
        out.push(lines[i]);
      } else {
        if (q >= 1) {
          lines[i].quantity = q;
          out.push(lines[i]);
        }
      }
    }
    saveCartLines(out);
  }

  /** Remove one product line. */
  function removeLine(productId) {
    var lines = getCartLines().filter(function (l) {
      return l.productId !== productId;
    });
    saveCartLines(lines);
  }

  /** Clear entire cart. */
  function clearCart() {
    saveCartLines([]);
  }

  // --- Invoices ---

  function getAllInvoices() {
    var inv = readJSON(LS_INVOICES, []);
    return Array.isArray(inv) ? inv : [];
  }

  function saveAllInvoices(list) {
    writeJSON(LS_INVOICES, list);
  }

  /** Unique invoice number. */
  function nextInvoiceNumber() {
    return "KFX-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  /**
   * Allocate discount across lines for display (proportional to line subtotal).
   */
  function lineItemsWithDiscount(lines, discountTotal, subtotal) {
    var items = [];
    if (subtotal <= 0) return items;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var lineSub = Number(l.unitPrice) * Number(l.quantity);
      var share = (lineSub / subtotal) * discountTotal;
      items.push({
        name: l.name,
        qty: Number(l.quantity),
        price: Number(l.unitPrice),
        discount: share,
        lineSubtotal: lineSub,
      });
    }
    return items;
  }

  /**
   * Build invoice from cart + shipping, persist to AllInvoices and user.invoices[].
   */
  function generateAndStoreInvoice(shipping) {
    var user = getCurrentUser();
    if (!user) return null;
    var lines = getCartLines();
    if (lines.length === 0) return null;

    var totals = computeCartTotals(lines);
    var items = lineItemsWithDiscount(lines, totals.discount, totals.subtotal);

    var invoice = {
      companyName: COMPANY_NAME,
      date: new Date().toISOString(),
      invoiceNumber: nextInvoiceNumber(),
      trn: user.trn,
      shipping: shipping,
      items: items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
    };

    var allInv = getAllInvoices();
    allInv.push(invoice);
    saveAllInvoices(allInv);

    if (!Array.isArray(user.invoices)) user.invoices = [];
    user.invoices.push(invoice);

    var idx = getCurrentUserIndex();
    var users = getRegistrationData();
    users[idx] = user;
    saveRegistrationData(users);

    clearCart();

    sessionStorage.setItem(SS_LAST_INV, JSON.stringify(invoice));
    return invoice;
  }

  // --- Registration handler ---

  function initRegisterPage() {
    var form = document.getElementById("register-form");
    var msg = document.getElementById("register-msg");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (msg) {
        msg.textContent = "";
        msg.classList.remove("form-msg--error");
      }

      var firstName = document.getElementById("reg-first-name").value.trim();
      var lastName = document.getElementById("reg-last-name").value.trim();
      var dob = document.getElementById("reg-dob").value;
      var gender = document.getElementById("reg-gender").value;
      var phone = document.getElementById("reg-phone").value.trim();
      var email = document.getElementById("reg-email").value.trim();
      var trn = normalizeTrn(document.getElementById("reg-trn").value);
      var password = document.getElementById("reg-password").value;

      if (!firstName || !lastName || !dob || !gender || !phone || !email || !trn || !password) {
        if (msg) {
          msg.textContent = "All fields are required.";
          msg.classList.add("form-msg--error");
        }
        return;
      }
      if (password.length < 8) {
        if (msg) {
          msg.textContent = "Password must be at least 8 characters.";
          msg.classList.add("form-msg--error");
        }
        return;
      }
      if (!isValidTrnFormat(trn)) {
        if (msg) {
          msg.textContent = "TRN must be in the format 000-000-000.";
          msg.classList.add("form-msg--error");
        }
        return;
      }
      /* Graded rule: age computed in JS from DOB; user must be >= 18 years old. */
      if (ageFromDob(dob) < 18) {
        if (msg) {
          msg.textContent = "You must be 18 or older to register (age is calculated from your date of birth).";
          msg.classList.add("form-msg--error");
        }
        return;
      }
      if (findUserByTrn(trn)) {
        if (msg) {
          msg.textContent = "This TRN is already registered.";
          msg.classList.add("form-msg--error");
        }
        return;
      }

      var users = getRegistrationData();
      var newUser = {
        firstName: firstName,
        lastName: lastName,
        dob: dob,
        gender: gender,
        phone: phone,
        email: email,
        trn: trn,
        password: password,
        registrationDate: new Date().toISOString(),
        cart: {},
        invoices: [],
      };
      users.push(newUser);
      saveRegistrationData(users);

      window.location.href = "index.html";
    });
  }

  // --- Login & reset password ---

  function initLoginPage() {
    var form = document.getElementById("login-form");
    var err = document.getElementById("login-msg");
    var resetForm = document.getElementById("reset-password-form");
    var resetMsg = document.getElementById("reset-msg");

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (err) {
          err.textContent = "";
          err.classList.remove("form-msg--error");
        }

        var trn = normalizeTrn(document.getElementById("login-trn").value);
        var password = document.getElementById("login-password").value;

        if (!isValidTrnFormat(trn)) {
          if (err) {
            err.textContent = "Enter a valid TRN (000-000-000).";
            err.classList.add("form-msg--error");
          }
          return;
        }

        if (getFailCount(trn) >= MAX_LOGIN_ATTEMPTS) {
          window.location.href = "lockout.html";
          return;
        }

        var user = findUserByTrn(trn);
        if (!user || user.password !== password) {
          var n = incrementFailCount(trn);
          if (err) {
            err.textContent = "Invalid TRN or password. Attempt " + n + " of " + MAX_LOGIN_ATTEMPTS + ".";
            err.classList.add("form-msg--error");
          }
          if (n >= MAX_LOGIN_ATTEMPTS) {
            window.location.href = "lockout.html";
          }
          return;
        }

        clearFailCount(trn);
        setSessionTrn(trn);
        window.location.href = "home.html";
      });
    }

    if (resetForm) {
      resetForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (resetMsg) {
          resetMsg.textContent = "";
          resetMsg.classList.remove("form-msg--error", "form-msg--ok");
        }

        var trn = normalizeTrn(document.getElementById("reset-trn").value);
        var pw = document.getElementById("reset-password").value;
        var pw2 = document.getElementById("reset-password-confirm").value;

        if (!isValidTrnFormat(trn)) {
          if (resetMsg) {
            resetMsg.textContent = "TRN must be 000-000-000.";
            resetMsg.classList.add("form-msg--error");
          }
          return;
        }
        if (pw.length < 8) {
          if (resetMsg) {
            resetMsg.textContent = "New password must be at least 8 characters.";
            resetMsg.classList.add("form-msg--error");
          }
          return;
        }
        if (pw !== pw2) {
          if (resetMsg) {
            resetMsg.textContent = "Passwords do not match.";
            resetMsg.classList.add("form-msg--error");
          }
          return;
        }

        var idx = findUserIndexByTrn(trn);
        if (idx === -1) {
          if (resetMsg) {
            resetMsg.textContent = "No account found for that TRN.";
            resetMsg.classList.add("form-msg--error");
          }
          return;
        }

        var users = getRegistrationData();
        users[idx].password = pw;
        saveRegistrationData(users);

        if (resetMsg) {
          resetMsg.textContent = "Password updated. You can sign in now.";
          resetMsg.classList.add("form-msg--ok");
        }
        resetForm.reset();
      });
    }
  }

  // --- Home / catalogue ---

  function initHomePage() {
    if (!requireAuth()) return;
    var mount = document.getElementById("product-catalog");
    if (!mount) return;

    var products = getAllProducts();
    var html = "";
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      html +=
        '<article class="product-card">' +
        '<div class="product-image-wrap">' +
        '<img src="' +
        escapeHtml(p.image) +
        '" width="400" height="400" alt="' +
        escapeHtml(p.name) +
        '" />' +
        "</div>" +
        '<div class="body">' +
        "<h3>" +
        escapeHtml(p.name) +
        "</h3>" +
        '<p class="price">' +
        formatMoney(p.price) +
        "</p>" +
        "<p>" +
        escapeHtml(p.description) +
        "</p>" +
        '<button type="button" class="btn btn-secondary" data-add-cart="' +
        escapeHtml(p.id) +
        '">Add to bag</button>' +
        "</div>" +
        "</article>";
    }
    mount.innerHTML = html;

    mount.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add-cart]");
      if (!btn) return;
      var id = btn.getAttribute("data-add-cart");
      addProductToCart(id);
    });
  }

  // --- Cart page ---

  function renderCartTable() {
    var tbody = document.querySelector("#cart-table tbody");
    var elSub = document.getElementById("cart-subtotal");
    var elDisc = document.getElementById("cart-discount");
    var elTax = document.getElementById("cart-tax");
    var elTot = document.getElementById("cart-total");
    if (!tbody) return;

    var lines = getCartLines();
    if (lines.length === 0) {
      window.location.href = "cart-empty.html";
      return;
    }

    var totals = computeCartTotals(lines);
    var rows = "";
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var lineSub = Number(l.unitPrice) * Number(l.quantity);
      rows +=
        "<tr>" +
        "<td>" +
        escapeHtml(l.name) +
        "</td>" +
        '<td class="numeric">' +
        formatMoney(l.unitPrice) +
        "</td>" +
        '<td class="numeric"><input type="number" min="1" class="cart-qty-input" data-product-id="' +
        escapeHtml(l.productId) +
        '" value="' +
        Number(l.quantity) +
        '" aria-label="Quantity for ' +
        escapeHtml(l.name) +
        '" /></td>' +
        '<td class="numeric">' +
        formatMoney(lineSub) +
        "</td>" +
        '<td><button type="button" class="btn btn-danger cart-remove-btn" data-product-id="' +
        escapeHtml(l.productId) +
        '">Remove</button></td>' +
        "</tr>";
    }
    tbody.innerHTML = rows;

    if (elSub) elSub.textContent = formatMoney(totals.subtotal);
    if (elDisc) elDisc.textContent = "\u2212 " + formatMoney(totals.discount);
    if (elTax) elTax.textContent = formatMoney(totals.tax);
    if (elTot) elTot.textContent = formatMoney(totals.total);
  }

  /** One-time delegated listeners on #cart-panel for qty/remove. */
  function bindCartPanelEvents() {
    var panel = document.getElementById("cart-panel");
    if (!panel || panel.getAttribute("data-cart-bound") === "1") return;
    panel.setAttribute("data-cart-bound", "1");
    panel.addEventListener("change", function (e) {
      var inp = e.target.closest(".cart-qty-input");
      if (!inp) return;
      var id = inp.getAttribute("data-product-id");
      updateLineQuantity(id, inp.value);
      renderCartTable();
    });
    panel.addEventListener("click", function (e) {
      var btn = e.target.closest(".cart-remove-btn");
      if (!btn) return;
      removeLine(btn.getAttribute("data-product-id"));
      renderCartTable();
    });
  }

  function initCartPage() {
    if (!requireAuth()) return;
    bindCartPanelEvents();
    var clearBtn = document.getElementById("cart-clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.preventDefault();
        clearCart();
        window.location.href = "cart-empty.html";
      });
    }
    renderCartTable();
  }

  // --- Checkout ---

  function renderCheckoutSummary() {
    var tbody = document.querySelector("#checkout-summary-table tbody");
    var sSub = document.getElementById("checkout-subtotal");
    var sDisc = document.getElementById("checkout-discount");
    var sTax = document.getElementById("checkout-tax");
    var sTot = document.getElementById("checkout-total");
    if (!tbody) return;

    var lines = getCartLines();
    if (lines.length === 0) {
      window.location.href = "cart-empty.html";
      return;
    }

    var totals = computeCartTotals(lines);
    var rows = "";
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var lineSub = Number(l.unitPrice) * Number(l.quantity);
      rows +=
        "<tr><td>" +
        escapeHtml(l.name) +
        "</td><td class=\"numeric\">" +
        l.quantity +
        '</td><td class="numeric">' +
        formatMoney(lineSub) +
        "</td></tr>";
    }
    tbody.innerHTML = rows;

    if (sSub) sSub.textContent = formatMoney(totals.subtotal);
    if (sDisc) sDisc.textContent = "\u2212 " + formatMoney(totals.discount);
    if (sTax) sTax.textContent = formatMoney(totals.tax);
    if (sTot) sTot.textContent = formatMoney(totals.total);
  }

  function initCheckoutPage() {
    if (!requireAuth()) return;
    renderCheckoutSummary();

    var form = document.getElementById("checkout-form");
    var clearAll = document.getElementById("checkout-clear-all");

    if (clearAll) {
      clearAll.addEventListener("click", function (e) {
        e.preventDefault();
        clearCart();
        window.location.href = "cart-empty.html";
      });
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ship = {
          fullName: document.getElementById("ship-name").value.trim(),
          phone: document.getElementById("ship-phone").value.trim(),
          address: document.getElementById("ship-address").value.trim(),
          city: document.getElementById("ship-city").value.trim(),
          postal: document.getElementById("ship-postal").value.trim(),
          notes: (document.getElementById("ship-notes") && document.getElementById("ship-notes").value) || "",
        };
        if (!ship.fullName || !ship.phone || !ship.address || !ship.city || !ship.postal) {
          alert("Please complete all required shipping fields.");
          return;
        }
        var inv = generateAndStoreInvoice(ship);
        if (!inv) {
          alert("Cart is empty.");
          return;
        }
        window.location.href = "invoice.html";
      });
    }
  }

  // --- Invoice view ---

  function initInvoicePage() {
    if (!requireAuth()) return;
    var raw = sessionStorage.getItem(SS_LAST_INV);
    var wrap = document.getElementById("invoice-dynamic");
    if (!wrap) return;

    if (!raw) {
      wrap.innerHTML =
        '<h1 id="inv-heading">Invoice</h1>' +
        '<p class="lead">No invoice is loaded. Complete checkout or return to the shop.</p>' +
        '<div class="form-actions"><a class="btn btn-primary" href="home.html">Shop</a> ' +
        '<a class="btn btn-outline" href="cart.html">Cart</a></div>';
      return;
    }

    var inv;
    try {
      inv = JSON.parse(raw);
    } catch (e) {
      wrap.innerHTML =
        '<h1 id="inv-heading">Invoice</h1><p class="lead">Invalid invoice data in session.</p>' +
        '<div class="form-actions"><a class="btn btn-primary" href="home.html">Home</a></div>';
      return;
    }

    var d = new Date(inv.date);
    var dateStr = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    var ship = inv.shipping || {};
    var shipBlock =
      "<section class=\"invoice-ship\" aria-labelledby=\"ship-inv-heading\">" +
      '<h2 id="ship-inv-heading" style="font-size:1rem;margin:1rem 0 0.5rem">Shipping</h2>' +
      "<ul style=\"list-style:none;padding:0;margin:0 0 1rem;line-height:1.5\">" +
      "<li><strong>Name:</strong> " +
      escapeHtml(ship.fullName || "") +
      "</li>" +
      "<li><strong>Phone:</strong> " +
      escapeHtml(ship.phone || "") +
      "</li>" +
      "<li><strong>Address:</strong> " +
      escapeHtml(ship.address || "") +
      "</li>" +
      "<li><strong>City:</strong> " +
      escapeHtml(ship.city || "") +
      " &nbsp; <strong>Postal:</strong> " +
      escapeHtml(ship.postal || "") +
      "</li>" +
      (ship.notes
        ? "<li><strong>Notes:</strong> " + escapeHtml(ship.notes) + "</li>"
        : "") +
      "</ul></section>";

    var rows = "";
    for (var i = 0; i < inv.items.length; i++) {
      var it = inv.items[i];
      var lineGross = it.lineSubtotal != null ? it.lineSubtotal : it.price * it.qty;
      var lineDisc = it.discount != null ? it.discount : 0;
      rows +=
        "<tr><td>" +
        escapeHtml(it.name) +
        '</td><td class="numeric">' +
        formatMoney(it.price) +
        '</td><td class="numeric">' +
        it.qty +
        '</td><td class="numeric">' +
        formatMoney(lineDisc) +
        '</td><td class="numeric">' +
        formatMoney(lineGross) +
        "</td></tr>";
    }

    wrap.innerHTML =
      "<header>" +
      '<p class="tagline">Order receipt</p>' +
      '<h1 id="inv-heading">Invoice</h1>' +
      "<p><strong>Company:</strong> " +
      escapeHtml(inv.companyName) +
      "</p>" +
      "<p><strong>Order date:</strong> <time>" +
      escapeHtml(dateStr) +
      "</time></p>" +
      "<p><strong>Invoice #:</strong> " +
      escapeHtml(inv.invoiceNumber) +
      "</p>" +
      "<p><strong>Customer TRN:</strong> " +
      escapeHtml(inv.trn) +
      "</p>" +
      "</header>" +
      shipBlock +
      '<div class="table-wrap"><table><caption class="sr-only">Invoice lines</caption><thead><tr>' +
      "<th scope=\"col\">Products</th><th class=\"numeric\" scope=\"col\">Unit price</th>" +
      "<th class=\"numeric\" scope=\"col\">Qty</th><th class=\"numeric\" scope=\"col\">Discount</th>" +
      '<th class="numeric" scope="col">Line</th></tr></thead><tbody>' +
      rows +
      "</tbody><tfoot>" +
      '<tr><th colspan="4" scope="row">Subtotal</th><td class="numeric">' +
      formatMoney(inv.subtotal) +
      "</td></tr>" +
      '<tr><th colspan="4" scope="row">Discount (total)</th><td class="numeric">\u2212 ' +
      formatMoney(inv.discount) +
      "</td></tr>" +
      '<tr><th colspan="4" scope="row">Tax</th><td class="numeric">' +
      formatMoney(inv.tax) +
      "</td></tr>" +
      '<tr><th colspan="4" scope="row">Total</th><td class="numeric">' +
      formatMoney(inv.total) +
      "</td></tr></tfoot></table></div>";
  }

  // --- Analytics: ShowUserFrequency ---

  /**
   * Count registered users by gender and age bucket (as of today).
   * Returns summary object; also renders bar charts into #user-frequency-charts when present.
   */
  function ShowUserFrequency() {
    var users = getRegistrationData();
    var genderCounts = { Male: 0, Female: 0, Other: 0, "Prefer not to say": 0 };
    var ageBuckets = { "18-25": 0, "26-35": 0, "36-50": 0, "50+": 0 };

    for (var i = 0; i < users.length; i++) {
      var g = users[i].gender || "Other";
      if (genderCounts[g] !== undefined) genderCounts[g]++;
      else genderCounts["Other"]++;

      var age = ageFromDob(users[i].dob);
      /* Only count adults in age bands (registration already requires 18+). */
      if (age < 18) {
        /* skip age buckets for invalid/legacy rows */
      } else if (age <= 25) ageBuckets["18-25"]++;
      else if (age <= 35) ageBuckets["26-35"]++;
      else if (age <= 50) ageBuckets["36-50"]++;
      else ageBuckets["50+"]++;
    }

    var summary = { genderCounts: genderCounts, ageBuckets: ageBuckets, totalUsers: users.length };
    console.log("ShowUserFrequency()", summary);

    var mount = document.getElementById("user-frequency-charts");
    if (mount) {
      mount.innerHTML =
        "<h3>By gender</h3>" +
        barBlock(genderCounts) +
        "<h3>By age group</h3>" +
        barBlock(ageBuckets);
    }

    return summary;
  }

  /** Build simple div-based horizontal bars. */
  function barBlock(counts) {
    var keys = Object.keys(counts);
    var max = 1;
    for (var i = 0; i < keys.length; i++) {
      if (counts[keys[i]] > max) max = counts[keys[i]];
    }
    var html = '<div class="bar-chart">';
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      var v = counts[k];
      var pct = Math.round((v / max) * 100);
      html +=
        '<div class="bar-chart-row">' +
        '<span class="bar-chart-label">' +
        escapeHtml(k) +
        "</span>" +
        '<div class="bar-chart-track"><div class="bar-chart-fill" style="width:' +
        pct +
        '%"></div></div>' +
        '<span class="bar-chart-value">' +
        v +
        "</span>" +
        "</div>";
    }
    html += "</div>";
    return html;
  }

  /**
   * Return invoices for a TRN (from AllInvoices).
   * @param {string} trn
   */
  function GetUserInvoices(trn) {
    var t = normalizeTrn(trn);
    return getAllInvoices().filter(function (inv) {
      return normalizeTrn(inv.trn) === t;
    });
  }

  /**
   * Render all invoices (optionally filtered by TRN) into #invoices-report.
   * @param {string} [filterTrn]
   */
  function ShowInvoices(filterTrn) {
    var list = getAllInvoices();
    var t = filterTrn ? normalizeTrn(filterTrn) : "";
    if (t && isValidTrnFormat(t)) {
      list = list.filter(function (inv) {
        return normalizeTrn(inv.trn) === t;
      });
    } else if (t) {
      list = list.filter(function (inv) {
        return inv.trn.indexOf(t) !== -1;
      });
    }

    console.log("ShowInvoices()", list.length, "invoice(s)");

    var mount = document.getElementById("invoices-report");
    if (!mount) return list;

    if (list.length === 0) {
      mount.innerHTML = "<p class=\"field-hint\">No invoices to display.</p>";
      return list;
    }

    var html = '<div class="table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>TRN</th><th>Total</th></tr></thead><tbody>';
    for (var i = list.length - 1; i >= 0; i--) {
      var inv = list[i];
      var d = new Date(inv.date).toLocaleString();
      html +=
        "<tr><td>" +
        escapeHtml(inv.invoiceNumber) +
        "</td><td>" +
        escapeHtml(d) +
        "</td><td>" +
        escapeHtml(inv.trn) +
        "</td><td>" +
        formatMoney(inv.total) +
        "</td></tr>";
    }
    html += "</tbody></table></div>";
    mount.innerHTML = html;
    return list;
  }

  function initAboutPage() {
    ShowUserFrequency();
    ShowInvoices("");
    var search = document.getElementById("invoice-trn-search");
    if (search) {
      search.addEventListener("input", function () {
        ShowInvoices(search.value.trim());
      });
    }
  }

  // --- Boot ---

  function boot() {
    seedProductsIfNeeded();

    var p = pageId();
    if (p === "register") initRegisterPage();
    else if (p === "login") initLoginPage();
    else if (p === "home") initHomePage();
    else if (p === "cart") initCartPage();
    else if (p === "checkout") initCheckoutPage();
    else if (p === "invoice") initInvoicePage();
    else if (p === "about") initAboutPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.ShowUserFrequency = ShowUserFrequency;
  window.ShowInvoices = ShowInvoices;
  window.GetUserInvoices = GetUserInvoices;
})();
