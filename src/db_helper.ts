import {createClient, RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts} from 'redis';
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
  static redisClient: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>;
  constructor(redisClient: RedisClientType) {
    DBHelper.redisClient = redisClient;
  }
  static async initializeDBConnection() {
    const options: {socket?: { host?: string, port: number }} = {};
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

export const getToken = async (email: string) => {
  return (JSON.parse(await DBHelper.redisClient.get(email) || "{}")).refresh_token;
}

export const getUsers = async (): Promise<string[]> => {
  return (JSON.parse(await DBHelper.redisClient.get('booking_users') || "{}"));
}

export const getRecEmail = async (email: string) => {
  return (await DBHelper.redisClient.get(`${email}_rec_email`))
}
export const getRecPassword = async (email: string) => {
  return (await DBHelper.redisClient.get(`${email}_rec_password`));
}

export const getDefaultWeekBookings = async (email: string): Promise<{day: string, court: string, time: string}[]> => {
  return (JSON.parse(await DBHelper.redisClient.get('default_week_bookings') || "{}")[email])
}