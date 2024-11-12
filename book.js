import puppeteer from 'puppeteer'
const log = (str) => {
  const date = new Date();
  console.log(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} - ${str}`);
}
import { getAccessToken, getLatestCode } from "./emailHelper.js";
import fs from "fs";
const secrets = JSON.parse(fs.readFileSync('/home/jellyfin/workspace/TennisBooker/secrets.json', 'utf8'));
log('script started');
const browser = await puppeteer.launch();
const page = await browser.newPage();
page.setDefaultTimeout(180000);
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0");
log('browser started');
await page.goto("https://www.rec.us/sfrecpark");
await page.setViewport({width: 1920, height: 1080});
log('on main page');
const today = new Date();
let numDaysAdvance;
let nextMonth = false;
if (today.getHours() === 7) {
  // morning booking is for 7 days in advance
  numDaysAdvance = 7;
} else if (today.getHours() === 11) {
  numDaysAdvance = 2;
} else {
  numDaysAdvance = 1;
}
let date = new Date();
date.setDate(today.getDate() + numDaysAdvance);
if (date.getMonth() !== today.getMonth()) {
  nextMonth = true;
}
date = date.getDate();

const time = '4:00 PM';
const court = 'Dolores';

log(`trying to get ${time} slot on the ${date} for ${court}`);
// login
await page.locator('text/Log In').click();
await page.type('input[id="email"]', secrets.email);
await page.type('input[id="password"]', secrets.password);
await page.locator('text/log in & continue').click();
log('logged in');
// navigate to court
await page.locator(`text/${court}`).click();
log(`on page for ${court}`);
// wait for time to be available
for(let i = 0; true; i++) {
  // click on date selector
  await page.locator('input').click();

  // click day you want in month
  await page.locator(`.react-datepicker__day--0${date}`).click();
  log('checking available times');
  // check available days for logging
  const times = await (await page.locator('text/Tennis').waitHandle()).evaluate(el =>  el.parentElement.innerText);
  if (times.length === 0) {
    log('no times available');
  } else if (times.includes(time)) {
    log('time is available');
    break;
  } else {
    log('found following times: ' + times.replace(/\n/g,' '));
  }

  const now = new Date();
  if (false && now.getMinutes() > 4 && now.getMinutes() < 50) {
    log("it's too late, terminating");
    throw new Error(`Couldn't find time within ${i} attempts`);
  } else if (now.getMinutes() > 58 && now.getSeconds() > 55) {
    await new Promise(res => setTimeout(res, 500));
  } else {
    await new Promise(res => setTimeout(res, 10000));
  }
  
  // if it's not there, refresh the page
  await page.evaluate(() => {
    location.reload();
  });
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
log('sending code');
// wait a few secs for email to come in
await new Promise(res => setTimeout(res, 2000));
const emailAccessToken = await getAccessToken();
const code = await getLatestCode(emailAccessToken);

// type code
await page.type('input[id="totp"]', code);
await page.locator('text/Confirm').click();
// if we don't get it wil say "Court already reserved at this time"
// if we do it will say You're all set!
try {
  await page.waitForSelector("text/You're all set!");
  log('success!, terminating');
} catch(e) {
  log('script was too late to book :(, terminating');
}
await browser.close();
