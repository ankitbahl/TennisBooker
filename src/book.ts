import {chromium, Page} from 'playwright';
import {deleteCodeEmail, getAccessToken, getLatestCode} from "./emailHelper.js";
import {existsSync, readFileSync, rmSync, writeFileSync} from 'fs';
import {homedir} from "node:os";
import {DBHelper, getDefaultWeekBookings, getRecEmail, getRecPassword, getToken, getUsers} from "./db_helper.js";
import * as fs from "node:fs";

const log = (str: string, email: string) => {
    const date = new Date();
    console.log(`${email}:${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} - ${str}`);
}

// the week starts with monday, max of 3 bookings per week

const bookingsDir = `${homedir}/workspace/TennisBooker/bookings`;
log('script started', '');
const browserType = 'chrome';

console.log('initializing redis connection');
await DBHelper.initializeDBConnection();

async function preGenerateCode(page: Page, recEmail: string, email: string, password: string, refreshToken: string): Promise<string | null> {
    const unpopularCourts = ['DuPont', 'McLaren'];
    const date = new Date();
    for (let i = 0; i < unpopularCourts.length; i++) {
        const court = unpopularCourts[i];
        await page.getByText(court).click();
        for (let j = 1; j < 7; j++) {
            const times = await (await page.getByText('Tennis').first()).evaluate(el => (el.parentElement as HTMLElement).innerText);
            if (times.includes(':')) {
                const time = times.split("\n").find(potentialTime => potentialTime.includes(":"));
                await page.getByText(time as string).click();
                await page.getByText('Select participant').click();
                await page.getByText('Account Owner').click();
                await page.locator('button.max-w-max').click();
                await page.getByText('Send Code').click();

                // wait a few secs for email to come in
                const emailAccessToken = await getAccessToken(refreshToken);
                return await getLatestCode(emailAccessToken, email) as string;
            }

            // go to next date
            date.setDate(date.getDate() + 1);
            let nextMonth = false;
            if (date.getDate() === 1) {
                nextMonth = true;
            }

            // click day you want in month, pad with 0 if one digit day
            await new Promise(res => setTimeout(res, 1000));
            await page.locator('input').click();
            if (nextMonth) {
                await page.locator('img[alt="right"]').click();
            }
            await page.locator(`.react-datepicker__day--0${date.getDate() < 10 ? '0' : ''}${date.getDate()}:not(.react-datepicker__day--outside-month)`).first().click();
        }
    }

    return null;
}

const emails = await getUsers();
async function bookCourt(email: string) {
    const refreshToken = await getToken(email);
    const defaultWeekBookings = await getDefaultWeekBookings(email);
    const recEmail = await getRecEmail(email);
    const password = await getRecPassword(email);

    if (!recEmail || !password) {
        log('No rec email or password found in db, terminating', email);
        return 1;
    }

    for (let i = 0; i < 2; i++) {
        const browser = await chromium.launch({headless: true});
        const context = await browser.newContext({
            recordVideo: {
                dir: 'videos/'
            }
        });
        const page = await context.newPage();
        // await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0");

        let pregeneratedCode;
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
            if (!weekBooking) {
                log('Week booking was undefined?', email);
                return 1;
            }
            const time = weekBooking.time;
            const court = weekBooking.court;

            log(`trying to get ${time} slot on the ${date} for ${court}`, email);

            // login
            await page.getByText('Log In').click();
            await page.type('input[id="email"]', recEmail);
            await page.type('input[id="password"]', password);
            await page.getByText('log in & continue').click();
            log('logged in', email);

            pregeneratedCode = await preGenerateCode(page, recEmail, email, password, refreshToken);
            await page.goto("https://www.rec.us/sfrecpark");


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
                await page.locator(`.react-datepicker__day--0${date < 10 ? '0' : ''}${date}:not(.react-datepicker__day--outside-month)`).first().click();
                log('checking available times', email);
                // check available days for logging
                const times = await (await page.getByText('Tennis').first()).evaluate(el => (el.parentElement as HTMLElement).innerText);
                if (times.length === 0) {
                    log('no times available', email);
                } else if (times.includes(time)) {
                    log('time is available', email);
                    break;
                } else {
                    log('found following times: ' + times.replace(/\n/g, ' '), email);
                }

                const now = new Date();
                if (now.getMinutes() > 2 && now.getMinutes() < 50) {
                    log("it's too late, terminating", email);
                    return 0;
                } else if ((now.getMinutes() > 58 && now.getSeconds() > 55) || now.getMinutes() <= 4) {
                    log('waiting 0.5s', email);
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

            // find longest available duration
            let longestAvailableDuration = '';
            for (let i = 3; i >= 0; i--) {
                const isDisabled = await page.locator('div[role="option"]').nth(i).evaluate(e => e.getAttribute('aria-disabled'))

                if (isDisabled === null) {
                    longestAvailableDuration = await page.locator('div[role="option"]').nth(i).evaluate((e: HTMLElement) => e.innerText)
                }
            }

            await page.getByText(longestAvailableDuration).first().click();

            await page.getByText('Select participant').click();

            await page.getByText('Account Owner').click();

            // click book
            await page.locator('button.max-w-max').click();

            await page.getByText('Send Code').click();
            let code;
            if (pregeneratedCode) {
                log('already have pregenerated code', email);
                code = pregeneratedCode;
            } else {
                log('sending code', email);
                // wait a few secs for email to come in
                await new Promise(res => setTimeout(res, 2000));
                const emailAccessToken = await getAccessToken(refreshToken);
                code = await getLatestCode(emailAccessToken, email);
            }


            // keep trying every second in case of issues
            //         page.setDefaultTimeout(10000);
            // type code
            log('entering code', email);
            await page.type('input[id="totp"]', code);

            page.setDefaultTimeout(180000);
            log('confirming with 3 min timeout', email);
            try {
                await page.getByText('Confirm').last().click();
            } catch (e) {
                // keep trying

                log("couldn't click confirm somehow", email);
                throw new Error(e as string);
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

            const videoFile = fs.readdirSync('videos/').find(file => file.endsWith('.webm') && !file.includes('attempt'));
            if (videoFile) {
                const today = new Date();
                fs.renameSync(`videos/${videoFile}`, `videos/${recEmail}_${today.getMonth()}-${today.getDate()}_${today.getHours()}_attempt${i}.webm`);
            }

            // clean up any emails
            await deleteCodeEmail(await getAccessToken(refreshToken), email);
        }
    }
}

const promises = emails.map(email => bookCourt(email));

await Promise.allSettled(promises);
process.exit(0);
