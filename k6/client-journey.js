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
  stages: [
    { duration: '20s', target: 3 },
    { duration: '1m', target: 8 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.20'],
    http_req_duration: ['p(95)<2500'],
    checkout_approved: ['count>0'],
  },
};

const checkoutApproved = new Counter('checkout_approved');
const checkoutDeclined = new Counter('checkout_declined');
const checkoutStockKo = new Counter('checkout_stock_ko');

const jsonHeaders = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  let user;
  group('1_login', () => {
    const res = http.post(
      `${USERS_URL}/users/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      { ...jsonHeaders, tags: { name: 'login' } },
    );
    check(res, { 'login 200': (r) => r.status === 200 });
    try { user = res.json(); } catch (_) { user = null; }
  });
  if (!user || !user.id) return;
  sleep(1);

  let products;
  group('2_list_products', () => {
    const res = http.get(`${PRODUCTS_URL}/products`, { tags: { name: 'list_products' } });
    check(res, { 'products 200': (r) => r.status === 200 });
    try { products = res.json(); } catch (_) { products = []; }
  });
  const inStock = (products || []).filter((p) => p.stock > 0);
  if (inStock.length === 0) return;
  const product = inStock[Math.floor(Math.random() * inStock.length)];
  sleep(1);

  group('3_add_to_cart', () => {
    const res = http.post(
      `${USERS_URL}/users/${user.id}/cart`,
      JSON.stringify({ product_id: product.id, quantity: 1 }),
      { ...jsonHeaders, tags: { name: 'add_to_cart' } },
    );
    check(res, { 'cart 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('4_checkout', () => {
    const res = http.post(
      `${BILLING_URL}/checkout`,
      JSON.stringify({
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1 }],
      }),
      { ...jsonHeaders, tags: { name: 'checkout' } },
    );
    check(res, {
      'checkout handled': (r) => [200, 402, 409].includes(r.status),
    });
    if (res.status === 200) checkoutApproved.add(1);
    else if (res.status === 402) checkoutDeclined.add(1);
    else if (res.status === 409) checkoutStockKo.add(1);
  });

  http.del(`${USERS_URL}/users/${user.id}/cart`, null, { tags: { name: 'clear_cart' } });
  sleep(1);
}
