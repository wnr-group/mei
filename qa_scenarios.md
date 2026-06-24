# MEI-25 Manual QA Test Scenarios

## Setup
- Dev server running on http://localhost:3001
- All automated tests pass (44 tests, 0 lint errors, 0 TypeScript errors)
- Contact form is accessible at http://localhost:3001/contact

## Test Scenarios

### Scenario 1: Submit without measurements
1. Navigate to http://localhost:3001/contact
2. Fill form:
   - Name: Test User 1
   - Email: testuser1@example.com
   - Phone: +919876543210
   - Occasion: Bridal Lehenga
   - Budget: 50000-100000
   - Message: Testing without measurements
3. Leave ALL measurement fields blank
4. Click Submit
5. Verify: "Inquiry Received" success screen appears
6. Verify in Supabase: measurements column is null

### Scenario 2: Submit with partial measurements (Bust + Waist only)
1. Reload page or navigate back
2. Fill form with same required fields
3. Fill only:
   - Bust: 34"
   - Waist: 26"
   - Leave hip, shoulder, length, sleeve blank
4. Click Submit
5. Verify: Success screen appears
6. Verify in Supabase: measurements = {"bust": "34\"", "waist": "26\"", "hip": null, "shoulder": null, "length": null, "sleeve": null}

### Scenario 3: Submit with full measurements
1. Reload page
2. Fill all required fields
3. Fill all measurement fields:
   - Bust: 34"
   - Waist: 26"
   - Hip: 36"
   - Shoulder: 14"
   - Length: 42"
   - Sleeve: 24"
4. Click Submit
5. Verify: Success screen appears
6. Verify in Supabase: All 6 measurement keys have non-null values

### Scenario 4: Image upload - single image
1. Reload form
2. Click "Select Images (0/5)" button
3. Select a valid JPEG file
4. Verify: Thumbnail appears in grid
5. Verify: Button changes to "Select Images (1/5)"

### Scenario 5: Image upload - max images
1. Continue adding images until 5 total
2. Verify: Button is replaced by "Maximum 5 images reached." message
3. Verify: No error shown

### Scenario 6: Remove an image
1. Hover over an image thumbnail
2. Click the × button on it
3. Verify: Image is removed from grid
4. Verify: Button reappears showing "Select Images (4/5)"

### Scenario 7: File type rejection
1. Click Select Images
2. Attempt to select a PDF or ZIP file
3. Verify: Error message appears: "filename.pdf" is not allowed. Use JPEG, PNG, or WebP.
4. Verify: File not added to grid

### Scenario 8: File size rejection
1. Attempt to upload an image over 5 MB
2. Verify: Error message: "filename.jpg" exceeds the 5 MB limit.
3. Verify: File not added

### Scenario 9: Duplicate file rejection
1. Add an image
2. Click Select Images again and pick the exact same file
3. Verify: Error message: "One or more images were already added and were skipped."
4. Verify: Image count stays same

### Scenario 10: Success clears state
1. Add 2 images
2. Fill required form fields + some measurements
3. Click Submit
4. Verify: "Inquiry Received" screen appears
5. Verify: Image previews are cleared
6. Verify: Measurement fields are empty
7. Verify: Form fields are reset
8. Verify in Supabase: reference_images = null (storage integration pending)

### Scenario 11: Admin panel loads
1. Navigate to http://localhost:3001/admin
2. Verify: Admin panel loads
3. Verify: Enquiries list is accessible
4. Verify: Can filter by NEW/REPLIED/CLOSED

### Scenario 12: Storefront pages load
1. Homepage: http://localhost:3001/ - loads, no console errors
2. Shop/Collection: http://localhost:3001/shop - loads, no console errors
3. Product page: click a product - loads, no console errors
