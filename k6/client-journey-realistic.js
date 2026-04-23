// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const USERS_URL = __ENV.USERS_URL || 'http://localhost:8001';
const PRODUCTS_URL = __ENV.PRODUCTS_URL || 'http://localhost:8002';
const BILLING_URL = __ENV.BILLING_URL || 'http://localhost:8004';

const EMAIL = __ENV.EMAIL || 'john.doe@kraftr.tech';
const PASSWORD = __ENV.PASSWORD || 'client123';

export const options = {
  scenarios: {
    browsers: {
      executor: 'ramping-vus',
      exec: 'browser',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '8m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    shoppers: {
      executor: 'ramping-vus',
      exec: 'shopper',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 3 },
        { duration: '6m', target: 6 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    abandoners: {
      executor: 'ramping-vus',
      exec: 'abandoner',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 2 },
        { duration: '8m', target: 4 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:shoppers}': ['rate<0.30'],
    'http_req_duration{name:checkout}': ['p(95)<3000'],
    checkout_approved: ['count>0'],
  },
};

const checkoutApproved = new Counter('checkout_approved');
const checkoutDeclined = new Counter('checkout_declined');
const checkoutStockKo = new Counter('checkout_stock_ko');
const cartsAbandoned = new Counter('carts_abandoned');

const jsonHeaders = { headers: { 'Content-Type': 'application/json' } };

function thinkTime(min, max) {
  sleep(min + Math.random() * (max - min));
}

function login() {
  const res = http.post(
    `${USERS_URL}/users/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { ...jsonHeaders, tags: { name: 'login' } },
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  try { return res.json(); } catch (_) { return null; }
}

function listProducts() {
  const res = http.get(`${PRODUCTS_URL}/products`, { tags: { name: 'list_products' } });
  check(res, { 'products 200': (r) => r.status === 200 });
  try { return res.json(); } catch (_) { return []; }
}

function viewProduct(productId) {
  http.get(`${PRODUCTS_URL}/products/${productId}`, { tags: { name: 'view_product' } });
}

// Browser: just looks around. No login, no purchase. Simulates anonymous traffic.
export function browser() {
  const products = listProducts();
  const inStock = (products || []).filter((p) => p.stock > 0);
  if (inStock.length === 0) return;

  const viewCount = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < viewCount; i++) {
    const p = inStock[Math.floor(Math.random() * inStock.length)];
    viewProduct(p.id);
    thinkTime(2, 8);
  }
}

// Shopper: full journey, login + browse + add to cart + checkout.
export function shopper() {
  const user = login();
  if (!user || !user.id) return;
  thinkTime(1, 3);

  const products = listProducts();
  const inStock = (products || []).filter((p) => p.stock > 0);
  if (inStock.length === 0) return;
  thinkTime(2, 5);

  const browseCount = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < browseCount; i++) {
    const p = inStock[Math.floor(Math.random() * inStock.length)];
    viewProduct(p.id);
    thinkTime(3, 10);
  }

  const itemCount = 1 + Math.floor(Math.random() * 3);
  const picked = [];
  for (let i = 0; i < itemCount; i++) {
    const p = inStock[Math.floor(Math.random() * inStock.length)];
    if (picked.find((x) => x.id === p.id)) continue;
    const qty = 1 + Math.floor(Math.random() * 3);
    http.post(
      `${USERS_URL}/users/${user.id}/cart`,
      JSON.stringify({ product_id: p.id, quantity: qty }),
      { ...jsonHeaders, tags: { name: 'add_to_cart' } },
    );
    picked.push({ id: p.id, quantity: qty });
    thinkTime(2, 6);
  }

  group('checkout', () => {
    const res = http.post(
      `${BILLING_URL}/checkout`,
      JSON.stringify({ user_id: user.id, items: picked }),
      { ...jsonHeaders, tags: { name: 'checkout' } },
    );
    check(res, { 'checkout handled': (r) => [200, 402, 409].includes(r.status) });
    if (res.status === 200) checkoutApproved.add(1);
    else if (res.status === 402) checkoutDeclined.add(1);
    else if (res.status === 409) checkoutStockKo.add(1);
  });

  http.del(`${USERS_URL}/users/${user.id}/cart`, null, { tags: { name: 'clear_cart' } });
  thinkTime(5, 15);
}

// Abandoner: logs in, browses, adds to cart, then leaves without checking out.
export function abandoner() {
  const user = login();
  if (!user || !user.id) return;
  thinkTime(2, 5);

  const products = listProducts();
  const inStock = (products || []).filter((p) => p.stock > 0);
  if (inStock.length === 0) return;
  thinkTime(3, 8);

  const product = inStock[Math.floor(Math.random() * inStock.length)];
  viewProduct(product.id);
  thinkTime(5, 12);

  http.post(
    `${USERS_URL}/users/${user.id}/cart`,
    JSON.stringify({ product_id: product.id, quantity: 1 }),
    { ...jsonHeaders, tags: { name: 'add_to_cart' } },
  );
  cartsAbandoned.add(1);
  thinkTime(10, 30);
}
