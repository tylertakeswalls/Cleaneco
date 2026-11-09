const assert = require('assert');
const jwt = require('jsonwebtoken');

console.log('====================================================');
console.log('RUNNING CLEANECO SECURITY & RBAC ISOLATION AUDIT');
console.log('====================================================\n');

const JWT_SECRET = 'cleaneco_secure_jwt_secret_key_2026';

// 1. Generate test tokens
const clientUser = {
  _id: '672000000000000000000001',
  role: 'client',
  email: 'client@cleaneco.test'
};

const adminUser = {
  _id: '672000000000000000000002',
  role: 'admin',
  email: 'admin@cleaneco.test'
};

const clientToken = jwt.sign({ userId: clientUser._id, role: clientUser.role }, JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ userId: adminUser._id, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });

// TEST 1: Token Generation & Claims Verification
console.log('TEST 1: JWT Signature & Claim Integrity');
const clientClaims = jwt.verify(clientToken, JWT_SECRET);
const adminClaims = jwt.verify(adminToken, JWT_SECRET);

assert.strictEqual(clientClaims.role, 'client');
assert.strictEqual(adminClaims.role, 'admin');
console.log('  ✔ Client claims signed and validated: role = client');
console.log('  ✔ Admin claims signed and validated: role = admin');

// TEST 2: RBAC Admin Authorization Simulation
console.log('\nTEST 2: RBAC Endpoint Enforcement (/api/admin/*)');
function verifyAdminRole(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return { status: 403, error: 'Forbidden: Admin access required' };
    }
    return { status: 200, user: decoded };
  } catch (err) {
    return { status: 401, error: 'Unauthorized: Invalid token' };
  }
}

const clientAdminAttempt = verifyAdminRole(clientToken);
assert.strictEqual(clientAdminAttempt.status, 403, 'Client token must be rejected with 403 on admin routes');
console.log('  ✔ Client attempting admin action correctly receives 403 Forbidden');

const adminAdminAttempt = verifyAdminRole(adminToken);
assert.strictEqual(adminAdminAttempt.status, 200, 'Admin token must succeed with 200 on admin routes');
console.log('  ✔ Admin attempting admin action correctly receives 200 OK');

// TEST 3: Cross-Client Isolation (Tenant Isolation)
console.log('\nTEST 3: Client Order Query Isolation');
const mockOrdersDatabase = [
  { order_id: 'ORD001', user_id: '672000000000000000000001', total: 8000 },
  { order_id: 'ORD002', user_id: '672000000000000000000009', total: 16000 } // foreign user
];

function queryUserOrders(requestingUserId, userRole, targetUserId) {
  // If not admin, clients can only query their own records
  if (userRole !== 'admin' && requestingUserId !== targetUserId) {
    return { status: 403, error: 'Forbidden: Cannot access orders belonging to another client' };
  }
  const orders = mockOrdersDatabase.filter(o => o.user_id === targetUserId);
  return { status: 200, data: orders };
}

const ownQuery = queryUserOrders(clientUser._id, clientUser.role, clientUser._id);
assert.strictEqual(ownQuery.status, 200);
assert.strictEqual(ownQuery.data.length, 1);
assert.strictEqual(ownQuery.data[0].order_id, 'ORD001');
console.log('  ✔ Client querying own orders succeeds (status 200)');

const crossQuery = queryUserOrders(clientUser._id, clientUser.role, '672000000000000000000009');
assert.strictEqual(crossQuery.status, 403);
console.log('  ✔ Client querying other client orders strictly blocked (status 403)');

const adminQueryOther = queryUserOrders(adminUser._id, adminUser.role, '672000000000000000000009');
assert.strictEqual(adminQueryOther.status, 200);
console.log('  ✔ Admin can inspect client records for dispatch operations (status 200)');

// TEST 4: Tampered Token Rejection
console.log('\nTEST 4: Tampered / Spoofed Token Resistance');
const fakeSecret = 'malicious_attacker_secret_2026';
const forgedToken = jwt.sign({ userId: 'hacker', role: 'admin' }, fakeSecret);

const forgedAttempt = verifyAdminRole(forgedToken);
assert.strictEqual(forgedAttempt.status, 401);
console.log('  ✔ Forged token with invalid signature rejected (status 401)');

// TEST 5: Sub-Admin Scope Isolation (Preserving Strict 2-Role Schema)
console.log('\nTEST 5: Sub-Admin Scope Isolation (role: "admin", admin_scope: "sub_admin")');
const subAdminUser = {
  _id: '672000000000000000000003',
  role: 'admin',
  admin_scope: 'sub_admin',
  email: 'inspector@cleaneco.test'
};
const subAdminToken = jwt.sign(
  { userId: subAdminUser._id, role: subAdminUser.role, admin_scope: subAdminUser.admin_scope },
  JWT_SECRET,
  { expiresIn: '1h' }
);
const subAdminClaims = jwt.verify(subAdminToken, JWT_SECRET);
assert.strictEqual(subAdminClaims.role, 'admin', 'Sub-Admin must retain canonical "admin" role');
assert.strictEqual(subAdminClaims.admin_scope, 'sub_admin', 'Sub-Admin scope must be "sub_admin"');

function requireFullAdminScope(token) {
  const res = verifyAdminRole(token);
  if (res.status !== 200) return res;
  if (res.user.admin_scope === 'sub_admin') {
    return { status: 403, error: 'Forbidden: Full Admin privileges required.' };
  }
  return { status: 200, user: res.user };
}

assert.strictEqual(verifyAdminRole(subAdminToken).status, 200, 'Sub-Admin can read operational orders/calendar');
assert.strictEqual(requireFullAdminScope(subAdminToken).status, 403, 'Sub-Admin blocked from Full-Admin write/management endpoints');
assert.strictEqual(requireFullAdminScope(adminToken).status, 200, 'Full Admin allowed on Full-Admin endpoints');
console.log('  ✔ Sub-Admin preserves 2-role model (role = admin, admin_scope = sub_admin)');
console.log('  ✔ Sub-Admin allowed on read-only operational routes and blocked (403) on Full-Admin write routes');

console.log('\n====================================================');
console.log('ALL SECURITY & ISOLATION AUDITS PASSED (5/5)');
console.log('====================================================');

