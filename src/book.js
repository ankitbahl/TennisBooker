import {chromium} from 'playwright';
import { getAccessToken, getLatestCode } from "./emailHelper.js";
import { writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
import { homedir } from "node:os";
import { DBHelper, getDefaultWeekBookings, getRecEmail, getRecPassword, getToken, getUsers } from "./db_helper.js";

const log = (str, email) => {
    const date = new Date();
    console.log(`${email}:${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} - ${str}`);
}

// the week starts with monday, max of 3 bookings per week

const bookingsDir = `${homedir}/workspace/TennisBooker/bookings`;
log('script started', '');
const browserType = 'chrome';

console.log('initializing redis connection');
await DBHelper.initializeDBConnection();



const emails = await getUsers();
async function bookCourt(email) {
    const refreshToken = await getToken(email);
    const defaultWeekBookings = await getDefaultWeekBookings(email);
    const recEmail = await getRecEmail(email);
    const password = await getRecPassword(email);


    for (let i = 0; i < 5; i++) {
        const browser = await chromium.launch({headless: true});
        const context = await browser.newContext();
        const page = await context.newPage();
        // await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0");

        try {
            log(`${browserType} started`, email);
            await page.goto("https://www.rec.us/sfrecpark");
            // await page.setViewport({width: 1920, height: 1080});
            log('on main page', email);
            const today = new Date();
            let numDaysAdvance;
            let nextMonth = false;
            if (today.getHours() === 7 || today.getHours() === 8) {
                // morning booking is for 7 days in advance
                numDaysAdvance = 7;
            } else if (today.getHours() === 11 || today.getHours() === 12) {
                numDaysAdvance = 2;
            } else {
                numDaysAdvance = 4;
            }
            let bookDate = new Date();
            bookDate.setDate(today.getDate() + numDaysAdvance);
            if (bookDate.getMonth() !== today.getMonth()) {
                nextMonth = true;
            }
            const bookingFilePath = `${bookingsDir}/${bookDate.getMonth() + 1}-${bookDate.getDate()}.txt`;
            if (existsSync(bookingFilePath)) {
                log(`found booking for ${bookDate.getDate()} already for ${readFileSync(bookingFilePath)}`, email);
                return 0;
            }
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            const defaultDays = defaultWeekBookings.map(defaultWeekBooking => defaultWeekBooking.day);
            const daysToBook = defaultDays.map((weekday) => {
                return days.indexOf(weekday);
            });

            if (!daysToBook.includes(bookDate.getDay())) {
                log('No booking will be made today, as its not one of the days to book.', email);
                return 0;
            }

            const date = bookDate.getDate();
            const weekBooking = defaultWeekBookings.find(defaultWeekBooking => defaultWeekBooking.day === days[bookDate.getDay()]);
            const time = weekBooking.time;
            const court = weekBooking.court;

            log(`trying to get ${time} slot on the ${date} for ${court}`, email);
// login
            await page.getByText('Log In').click();
            await page.type('input[id="email"]', recEmail);
            await page.type('input[id="password"]', password);
            await page.getByText('log in & continue').click();
            log('logged in', email);
// navigate to court
            await page.getByText(court).click();
            log(`on page for ${court}`, email);
            // page.setDefaultTimeout(10000);
// wait for time to be available
            for (let i = 0; true; i++) {
                // click on date selector
                await page.locator('input').click();

                if (nextMonth) {
                    await page.locator('img[alt="right"]').click();
                }
                // click day you want in month, pad with 0 if one digit day
                await page.locator(`.react-datepicker__day--0${date < 10 ? '0' : ''}${date}`).last().click();
                log('checking available times', email);
                // check available days for logging
                const times = await (await page.getByText('Tennis')).evaluate(el => el.parentElement.innerText);
                if (times.length === 0) {
                    log('no times available', email);
                } else if (times.includes(time)) {
                    log('time is available', email);
                    break;
                } else {
                    log('found following times: ' + times.replace(/\n/g, ' '), email);
                }

                const now = new Date();
                if (now.getMinutes() > 4 && now.getMinutes() < 50) {
                    log("it's too late, terminating", email);
                    return 0;
                } else if ((now.getMinutes() > 58 && now.getSeconds() > 55) || now.getMinutes() <= 4) {
                    log('waiting 0.5s, email')
                    await new Promise(res => setTimeout(res, 500));
                } else {
                    log('waiting 10s', email);
                    await new Promise(res => setTimeout(res, 10000));
                }

                // if it's not there, refresh the page
                log('refreshing page', email);
                await page.reload();
                log('done refresh', email);
            }

// create semaphore via file creation
            const fileName = `${homedir}/workspace/TennisBooker/temp/${court}_${date}_${time}`;

// another process has already got to this point, no need to continue
            if (existsSync(fileName)) {
                log('another process has already started the booking process, terminating', email);
                return 0;
            } else {
                try {
                    writeFileSync(fileName, '');
                } catch (e) {
                    log('failed to create file, terminating', email);
                    console.error(e);
                    return 1;
                }
            }

// delete file
            rmSync(fileName);

// click on time you want
            await page.getByText(time).click();

// click on button under duration to select duration
            await page.locator(`xpath=//label[text()='Duration']/following-sibling::button`).click();

// try to click each one to get the longest time
            const durations = ['2 hours', '90 min', '1 hour', '30 min']


// wait for load
            await page.waitForSelector('text=2 hours');

// get first unavailable duration to find longest duration possible
            const firstUnavailableDuration = await page.locator('div[role="option"][aria-disabled="true"]').first().evaluate(e => e.innerText);
            const longestAvailableDuration = durations[durations.indexOf(firstUnavailableDuration) + 1];

            await page.getByText(longestAvailableDuration).first().click();

            await page.getByText('Select participant').click();

            await page.getByText('Account Owner').click();

// click book
            await page.locator('button.max-w-max').click();

            await page.getByText('Send Code').click();
            log('sending code', email);
// wait a few secs for email to come in
            await new Promise(res => setTimeout(res, 2000));
            const emailAccessToken = await getAccessToken(refreshToken);
            const code = await getLatestCode(emailAccessToken);


// keep trying every second in case of issues
//         page.setDefaultTimeout(10000);
// type code
            log('entering code', email);
            await page.type('input[id="totp"]', code);

            // page.setDefaultTimeout(180000);
            log('confirming with 3 min timeout', email);
            try {
                await page.getByText('Confirm').last().click();
            } catch (e) {
                // keep trying

                log("couldn't click confirm somehow", email);
                throw new Error(e);
            }

            // if we don't get it wil say "Court already reserved at this time"
            // if we do it will say You're all set!
            try {
                await page.waitForSelector("text=You're all set!");
                log('success!, terminating', email);

                // make a file for the booking
                writeFileSync(bookingFilePath, `${court}: ${time}`);
                return 0;
            } catch (e) {
                console.error(e);
                log('script was too late to book :(, terminating', email);
                return 1;
            }
        } catch (e) {
            log('caught error, restarting', email);
            console.error(e);
            try {
                await page.screenshot({path: `failure${i}.png`})
            } catch (e) {
                log('screenshot failed', email);
            }
        } finally {
            await browser.close();
        }
    }
}

const promises = emails.map(email => bookCourt(email));

await Promise.allSettled(promises);
process.exit(0);
