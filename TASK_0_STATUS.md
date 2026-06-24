# MEI-25 Task 0: Schema Verification and Migration — STATUS REPORT

**Date:** 2026-06-17  
**Task:** Schema Verification and Migration  
**Feature:** MEI-25 — Quote Form: Measurements & Reference Image Upload

---

## Summary

Task 0 is PHASE 0 verification only. No code files change in this task. This document confirms the schema verification checklist and provides migration instructions.

---

## Current State Analysis

### Existing Schema (from database.ts)

The `enquiries` table currently has these columns (from `/src/lib/supabase/database.ts` lines 47-51):

```typescript
enquiries: {
  Row: { 
    id: string
    name: string
    email: string
    phone: string | null
    occasion: string | null
    budget: string | null
    message: string
    status: 'NEW' | 'REPLIED' | 'CLOSED'
    admin_reply: string | null
    replied_at: string | null
    replied_by: string | null
    created_at: string
  }
}
```

### Missing Columns (Task 0 Requirement)

The following columns are **MISSING** and must be added:

1. **`measurements`** (JSONB) — stores optional body measurements as JSON
   - Expected structure: `{ bust?, waist?, hip?, shoulder?, length?, sleeve? }`
   - All fields optional and nullable

2. **`reference_images`** (JSONB) — stores optional reference image URLs as JSON
   - Expected structure: Array of URL strings `["url1", "url2", ...]`
   - Maximum 5 images (enforced client-side in Task 3)

---

## Migration Required

### Step 1: Verify Current Schema (in Supabase Dashboard)

Navigate to **SQL Editor** and run:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enquiries'
ORDER BY ordinal_position;
```

**Expected current columns:**
- id (uuid)
- name (text)
- email (text)
- phone (text)
- occasion (text)
- budget (text)
- message (text)
- status (text)
- admin_reply (text)
- replied_at (timestamp)
- replied_by (text)
- created_at (timestamp)

**Verify:** `measurements` and `reference_images` are **NOT** in this list.

### Step 2: Add `measurements` Column

Run in SQL Editor:

```sql
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS measurements JSONB;
```

### Step 3: Add `reference_images` Column

Run in SQL Editor:

```sql
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS reference_images JSONB;
```

### Step 4: Verify Both Columns Now Exist

Re-run the SELECT from Step 1:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enquiries'
ORDER BY ordinal_position;
```

**Expected result:** Both `measurements` and `reference_images` should now appear with type `jsonb`.

---

## Consolidated Migration Script (for convenience)

You can copy-paste this entire block into **SQL Editor** at once:

```sql
-- Task 0: Schema Verification and Migration for MEI-25

-- Step 1: Check current schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enquiries'
ORDER BY ordinal_position;

-- Step 2-3: Add missing columns (idempotent — safe to run multiple times)
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS measurements JSONB;

ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS reference_images JSONB;

-- Step 4: Verify both columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enquiries'
ORDER BY ordinal_position;
```

---

## Completion Checklist

- [ ] Logged into Supabase Dashboard: https://app.supabase.com/
- [ ] Selected project: `hjhqemsyufsifmgespur`
- [ ] Navigated to SQL Editor
- [ ] Ran Step 1 SELECT and confirmed `measurements` and `reference_images` are **NOT** currently present
- [ ] Ran ALTER TABLE for `measurements`
- [ ] Ran ALTER TABLE for `reference_images`
- [ ] Ran Step 4 verification SELECT
- [ ] Confirmed both new columns now appear in schema with type `jsonb`

---

## Next Steps

Once both columns are verified to exist in Supabase:

1. **Task 1:** Extend the data layer (database.ts, enquiries.ts, tests)
2. **Task 2:** Measurements UI section + submit wiring
3. **Task 3:** Image upload UI with file validation
4. **Task 4:** Quality gates and manual QA

Code implementation **cannot begin** until schema verification is complete.

---

## Notes

- Both `measurements` and `reference_images` columns are **nullable** (NULL is allowed)
- Using `IF NOT EXISTS` clause ensures migrations are idempotent (safe to run multiple times)
- No data migration needed — adding columns to existing table is a safe operation
- Existing enquiries rows will have NULL for both new columns until new data is submitted
- TypeScript type definitions will be updated in Task 1 to reflect these new columns

---

## Related Documentation

- **Feature Spec:** `/docs/superpowers/plans/2026-06-17-mei-25-quote-form-measurements-images.md`
- **DB Type Defs:** `/src/lib/supabase/database.ts`
- **Enquiries Service:** `/src/lib/services/enquiries.ts`
- **Supabase Project:** https://app.supabase.com/project/hjhqemsyufsifmgespur

