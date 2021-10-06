import { formatMsToTime } from './functions';
import { LoggerType } from './models';
import { debugSteps, debugTime } from './variables';

let timeStart: number;

export function logger(file: LoggerType, step: string, forceLog: boolean = false): void {
  if (debugSteps || forceLog) {
    console.log(
      `%c${file}%c${step}`,
      'background-color: #1F2D3D; color: white; padding: 2px 4px; border-top-left-radius: 3px; border-bottom-left-radius: 3px;',
      'background-color: #9C99FC; color: white; padding: 2px 4px; border-top-right-radius: 3px; border-bottom-right-radius: 3px;',
    );
  }
}

export function loggerTimeStamp(message: string = '', variable: any = null): number {
  const timeNow = new Date().getTime();
  if (timeStart === undefined) timeStart = new Date().getTime();

  if (debugTime) {
    console.log(
      `%c${formatMsToTime(timeNow - timeStart)}%c${message}%c${variable ? variable : ''}`,
      `background-color: #1F2D3D; color: white; padding: 2px 4px; border-top-left-radius: 3px; border-bottom-left-radius: 3px;`,
      `background-color: #01B719; color: white; padding: 2px 4px;${!variable ? 'border-top-right-radius: 3px; border-bottom-right-radius: 3px;' : ''}`,
      `background-color: #8492A6; color: white; padding: 2px 4px; border-top-right-radius: 3px; border-bottom-right-radius: 3px;`,
    );
  }

  return timeNow;
}

export function loggerGetTime(time: 'start' | 'now' = 'now'): number {
  const timeNow = new Date().getTime();
  if (time === 'start') {
    return timeStart;
  }

  if (time === 'now') {
    return timeNow - timeStart;
  }
}
