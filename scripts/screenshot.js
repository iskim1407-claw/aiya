const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

async function takeScreenshots() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  })
  
  const screenshotDir = path.join(__dirname, '..', 'screenshots')
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true })
  }

  try {
    // 1. 홈 페이지
    console.log('📸 홈 페이지 캡처 중...')
    let page = await context.newPage()
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(screenshotDir, '1-home.png') })
    await page.close()
    console.log('✅ 1-home.png 완료')

    // 2. 아이 페이지
    console.log('📸 아이 모드 캡처 중...')
    page = await context.newPage()
    await page.goto('http://localhost:3000/child', { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(screenshotDir, '2-child.png') })
    await page.close()
    console.log('✅ 2-child.png 완료')

    // 3. 부모 대시보드
    console.log('📸 부모 대시보드 캡처 중...')
    page = await context.newPage()
    await page.goto('http://localhost:3000/parent', { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(screenshotDir, '3-parent.png') })
    await page.close()
    console.log('✅ 3-parent.png 완료')

    console.log(`\n✅ 모든 스크린샷 완료!`)
    console.log(`📁 저장 위치: ${screenshotDir}`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await context.close()
    await browser.close()
  }
}

takeScreenshots()
