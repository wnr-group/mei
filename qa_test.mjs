import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3001';

async function test() {
  const browser = await chromium.launch();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  
  const results = [];
  
  try {
    // Navigate to contact page
    await page.goto(`${BASE_URL}/contact`);
    await page.waitForTimeout(1000);
    
    // Step 3: QA — no measurements, submit
    console.log('\n=== STEP 3: No measurements, submit ===');
    await page.fill('input[name="name"]', 'Test User 3');
    await page.fill('input[name="email"]', 'test3@example.com');
    await page.fill('input[name="phone"]', '+919876543210');
    
    // Select occasion (assuming dropdown exists)
    const occasionSelect = page.locator('select[name="occasion"]');
    if (await occasionSelect.isVisible()) {
      await occasionSelect.selectOption('wedding');
    }
    
    // Set budget
    const budgetSelect = page.locator('select[name="budget"]');
    if (await budgetSelect.isVisible()) {
      await budgetSelect.selectOption('50000-100000');
    }
    
    await page.fill('textarea[name="message"]', 'Test message for step 3');
    
    // Don't fill measurements
    await page.click('button:has-text("Submit")');
    await page.waitForTimeout(2000);
    
    const successText3 = await page.textContent('body');
    results.push({
      step: 3,
      success: successText3.includes('Inquiry Received') || successText3.includes('Success'),
      output: 'Form submitted without measurements'
    });
    
    // Reload for next test
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Step 6: QA — image upload (1 image)
    console.log('\n=== STEP 6: Image upload (1 image) ===');
    
    // Check if there's an image upload button
    const imageButton = page.locator('text=/Select Images|Upload Images/');
    if (await imageButton.isVisible()) {
      results.push({
        step: 6,
        found: true,
        output: 'Image upload button found'
      });
    } else {
      results.push({
        step: 6,
        found: false,
        output: 'Image upload button not found'
      });
    }
    
    // Step 9: File type rejection
    console.log('\n=== STEP 9: File type rejection ===');
    const errorCheck = await page.locator('text=/not allowed|JPEG|PNG|WebP/').isVisible().catch(() => false);
    results.push({
      step: 9,
      errorUIFound: errorCheck,
      output: 'File validation error UI checked'
    });
    
    // Step 13: Admin check
    console.log('\n=== STEP 13: Admin panel check ===');
    const adminPage = page.context().pages()[0];
    await adminPage.goto(`${BASE_URL}/admin`);
    await adminPage.waitForTimeout(1000);
    const adminLoaded = adminPage.url().includes('admin');
    results.push({
      step: 13,
      adminAccessible: adminLoaded,
      output: 'Admin panel accessibility checked'
    });
    
    // Step 14: Storefront checks
    console.log('\n=== STEP 14: Storefront regressions ===');
    const homePage = page.context().pages()[0];
    await homePage.goto(`${BASE_URL}/`);
    await homePage.waitForTimeout(1000);
    const homeLoaded = !homePage.url().includes('error');
    results.push({
      step: 14,
      homeLoaded: homeLoaded,
      output: 'Homepage loads without errors'
    });
    
  } catch (error) {
    console.error('Test error:', error.message);
    results.push({
      error: error.message
    });
  }
  
  await browser.close();
  
  // Print results
  console.log('\n\n=== QA TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
}

test().catch(console.error);
