import axios from 'axios';
const OAUTH_HOST = "https://oauth2.googleapis.com";
const API_HOST = "https://gmail.googleapis.com";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { client_secret, client_id, email } = require('../secrets.json');

export const getAccessToken = async (refreshToken) => {
  const url = new URL(OAUTH_HOST);
  url.pathname = "/token";
  url.searchParams.append("client_secret", client_secret);
  url.searchParams.append("client_id", client_id);
  url.searchParams.append("grant_type", "refresh_token");
  url.searchParams.append("refresh_token", refreshToken);

  return (await axios.post(url.toString())).data.access_token;
}

const getCurrentThreads = async (accessToken) => {
  const url = new URL(API_HOST);
  url.pathname = `/gmail/v1/users/${email}/threads`;
  const res = await axios.get(url.toString(), {headers: {Authorization: `Bearer ${accessToken}`}});
  return res.data;
}

const deleteEmail = async (accessToken, threadId) => {
  const url = new URL(API_HOST);
  url.pathname = `/gmail/v1/users/${email}/threads/${threadId}`;
  const res = await axios.delete(url.toString(), {headers: {Authorization: `Bearer ${accessToken}`}});
  console.log(res.data);
  return res;
};

export const getLatestCode = async (accessToken) => {
  let emailFound = false;
  let snippet;
  for (let n = 0; !emailFound; n++) {
    const threads = (await getCurrentThreads(accessToken)).threads;
    for (let i = 0; i < threads.length; i++) {
      if (threads[i].snippet.includes("Your REC verification code is: ")) {
        snippet = threads[i].snippet;
        await deleteEmail(accessToken, threads[i].id);
        emailFound = true;
        break;
      }
    }

    await new Promise(res => setTimeout(res, 1000));
    console.log(n);
  }

  return snippet.match(/Your REC verification code is: (\d*)/)[1];
}

// const accessToken = await getAccessToken("1//0668qyThd9zQPCgYIARAAGAYSNwF-L9IrHb9d30pRABMtKUYrYD2mts7Km7TcDoQT8AF38rOwoshxT8A3xFYsfLdsndCEA2-H-dA");
// console.log(await getCurrentThreads(accessToken));
