import { createClient } from 'redis';
import { lookup } from 'dns';

const isDocker = async () => {
  return new Promise(resolve =>
    lookup('host.docker.internal', (err, res) => {
      if (err) {
        resolve(false);
      } else if (res) {
        resolve(true);
      } else {
        resolve(false);
      }
    })
  )
}

export class DBHelper {
  static redisClient;
  constructor(redisClient) {
    DBHelper.redisClient = redisClient;
  }
  static async initializeDBConnection() {
    const options = {};
    if (await isDocker()) {
      options.socket = { host: 'host.docker.internal', port: 6378 };
    } else {
      options.socket = { port: 6378 };
    }

    const redisClient = createClient(options);
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();
    DBHelper.redisClient = redisClient;
  }
}

export const getToken = async (email) => {
  return (JSON.parse(await DBHelper.redisClient.get(email) || "{}")).refresh_token;
}