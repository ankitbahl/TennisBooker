import puppeteer from 'puppeteer'
import { getAccessToken, getLatestCode } from "./emailHelper.js";
import fs from "fs";
const secrets = JSON.parse(fs.readFileSync('./secrets.json', 'utf8'));
const browser = await puppeteer.launch({headless: false});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0");
await page.goto("https://www.rec.us/sfrecpark");
await page.setViewport({ width: 1920, height: 1080 });

const time = "4:00 PM";
// login
await page.locator('text/Log In').click();
await page.type('input[id="email"]', secrets.email);
await page.type('input[id="password"]', secrets.password);
await page.locator('text/log in & continue').click();
// navigate to court
await page.locator('text/Dolores').click();

// wait for time to be available
for(let i = 0; true; i++) {
  // click on date selector
  await page.locator('input').click();

  // click day you want in month
  await page.locator(`.react-datepicker__day--009`).click();

  // check available days for logging
  const times = await (await page.locator('text/Tennis').waitHandle()).evaluate(el =>  el.parentElement.innerText);
  if (times.includes(time)) {
    break;
  }

  // if it's not there, refresh the page
  await page.evaluate(() => {
    location.reload();
  })
}

// click on time you want
await page.locator(`text/${time}`).click();

// click on button under duration to select duration
await page.locator(`xpath///label[text()='Duration']/following-sibling::button`).click();

// try to click each one to get the longest time
const durations = ['2 hours', '90 min', '1 hour', '30 min']


// wait for load
await page.waitForSelector('text/2 hours');

// get first unavailable duration to find longest duration possible
const firstUnavailableDuration = await page.$eval('div[role="option"][aria-disabled="true"]', e=> e.innerText);
const longestAvailableDuration = durations[durations.indexOf(firstUnavailableDuration) + 1];

await page.locator(`text/${longestAvailableDuration}`).click();

await page.locator('text/Select participant').click();

await page.locator(`text/${secrets.participant_name}`).click();

// click book
await page.locator('button.max-w-max').click();

await page.locator('text/Send Code').click();

// wait a few secs for email to come in
await new Promise(res => setTimeout(res, 2000));
const emailAccessToken = await getAccessToken();
const code = await getLatestCode(emailAccessToken);

// type code
await page.type('input[id="totp"]', code);
await page.locator('text/Confirm').click();
// if we don't get it wil say "Court already reserved at this time"
// if we do it will say You're all set!
await page.waitForSelector("text/You're all set!");
console.log('Successful!');
await browser.close();
