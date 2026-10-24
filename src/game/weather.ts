import { GY, W, WIND } from "./config";
import type { Cloud, Star, Theme } from "./types";
import { rnd } from "./util";

/** 몇 초마다 목표 풍속을 새로 정하고, 현재 풍속은 그쪽으로 천천히 따라간다. 양수 = 오른쪽 */
export class Wind {
  speed = rnd(-1, 1);
  private target = rnd(-WIND.max, WIND.max);
  private nextChange = rnd(...WIND.changeEvery);

  update(dt: number) {
    this.nextChange -= dt;
    if (this.nextChange <= 0) {
      this.target = rnd(-WIND.max, WIND.max);
      this.nextChange = rnd(...WIND.changeEvery);
    }
    this.speed += (this.target - this.speed) * Math.min(1, dt * 0.4);
  }
}

export function makeClouds(): Cloud[] {
  return Array.from({ length: 5 }, (_, i) => ({ x: i * 190 + rnd(0, 80), y: rnd(30, 150), s: rnd(0.7, 1.3), v: rnd(6, 14) }));
}

export function moveClouds(clouds: Cloud[], wind: number, dt: number) {
  for (const c of clouds) {
    c.x += (c.v + wind * WIND.cloudDrift) * dt;
    if (c.x > W + 140) c.x = -140;
    else if (c.x < -160) c.x = W + 120;
  }
}

export function makeStars(): Star[] {
  return Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, GY - 70), r: rnd(0.6, 1.9), ph: rnd(0, 6.28) }));
}

/** 저녁 7시 ~ 아침 6시는 밤 테마 */
export const themeForHour = (hour = new Date().getHours()): Theme => (hour >= 19 || hour < 6 ? "night" : "day");
