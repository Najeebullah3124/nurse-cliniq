/**
 * Simple password hashing for prototype. In production use bcrypt.
 */

function hashPassword(password) {
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = ((h << 5) - h) + password.charCodeAt(i) | 0;
  }
  return 'hash_' + Math.abs(h).toString(16);
}

function verifyPassword(password, storedHash) {
  return hashPassword(password) === storedHash;
}

module.exports = { hashPassword, verifyPassword };
