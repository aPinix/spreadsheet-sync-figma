import { SpreadsheetSheetsData } from './models';

export function formatDataFillEmpty(data: SpreadsheetSheetsData): SpreadsheetSheetsData {
  const newData = data.map(sheet => {
    let maxCells = sheet[0].length;
    return sheet.map(elem => elem.length < maxCells ? elem = [...elem, ...Array(maxCells - elem.length).fill('').map((_, i) => '')] : elem);
  });

  return newData;
}

// code chunk from (https://github.com/yuanqing/create-figma-plugin)
export function showLoadingNotification(message: string): () => void {
  const notificationHandler = figma.notify(message, {
    timeout: 60000
  });

  return (): void => {
    notificationHandler.cancel();
  }
}

export function formatMsToTime(ms: number): string {
  const pad = (num: number, size: number = 2) => `00${num}`.slice(-size);

  const hours: string = pad(ms / 3.6e6 | 0);
  const minutes: string = pad((ms % 3.6e6) / 6e4 | 0);
  const seconds: string = pad((ms % 6e4) / 1000 | 0);
  const milliseconds: string = pad(ms % 1000, 3);
  return `${minutes}:${seconds}s`;
}

export function formatTimeToMs(hrs: number = 0, min: number = 0, sec: number = 0) {
  return ((hrs * 60 * 60 + min * 60 + sec) * 1000);
}
