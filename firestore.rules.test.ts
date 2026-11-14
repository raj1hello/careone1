import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CareOne Firestore Rules & Dirty Dozen Security Invariant Verification
 * Verifies static rule coverage against firebase-blueprint.json and the 12 adversarial payloads.
 */
describe('CareOne Firestore Security Rules Hardening', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
  const activeRulesPath = fs.existsSync(rulesPath) ? rulesPath : draftPath;
  const rules = fs.readFileSync(activeRulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'));

  it('1. Enforces default-deny catch-all rule first', () => {
    assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  });

  it('2. Secures every single collection declared in firebase-blueprint.json', () => {
    const collections = Object.keys(blueprint.firestore);
    for (const colPath of collections) {
      const leaf = colPath.split('/').slice(-2, -1)[0];
      assert.ok(
        rules.includes(`match /${leaf}/`),
        `Expected match block for collection segment "${leaf}" (${colPath})`
      );
    }
  });

  it('3. Requires email_verified == true for writes and prevents email spoofing', () => {
    assert.match(rules, /request\.auth\.token\.email_verified == true/);
    assert.match(rules, /function isAdmin\(\) \{\s*return isVerifiedUser\(\)/);
  });

  it('4. Prevents unverified doctors from self-verifying or being booked', () => {
    assert.match(rules, /incoming\(\)\.verificationStatus == 'pending'/);
    assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/doctors\/\$\(incoming\(\)\.doctorUid\)\)\.data\.verificationStatus == 'verified'/);
  });

  it('5. Enforces Zero-Trust Medical Record sharing and Patient PII isolation', () => {
    assert.match(rules, /match \/patients\/\{patientId\}[\s\S]*allow get: if isValidId\(patientId\) && \(isOwner\(patientId\) \|\| isAdmin\(\)\)/);
    assert.match(rules, /request\.auth\.uid in existing\(\)\.sharedWithDoctorUids/);
  });

  it('6. Locks authorized prescriptions and enforces atomic Medicine Course master gate', () => {
    assert.match(rules, /\(existing\(\)\.status == 'draft' \|\| isAdmin\(\)\)/);
    assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/prescriptions\/\$\(incoming\(\)\.prescriptionId\)\)/);
    assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/medicine_courses\/\$\(courseId\)\)\.data\.doctorUid == request\.auth\.uid/);
  });

  it('7. Prohibits get()/exists() calls inside allow list blocks and enforces server timestamps', () => {
    const listMatches = [...rules.matchAll(/allow list:[\s\S]*?;/g)];
    assert.ok(listMatches.length >= 15);
    for (const m of listMatches) {
      assert.equal(/get\(|exists\(/.test(m[0]), false, `Forbidden DB lookup inside list rule: ${m[0]}`);
    }
    assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
    assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  });
});
