import { ChangeTypes } from './models';

export function isStringType(phrase: string, type: ChangeTypes, startsWith: boolean = false): boolean {
  if (type === ChangeTypes.IMAGE) {
    return phrase.toLowerCase().match(new RegExp(getRegexByType(type, startsWith), 'g')) ? true : false;
  }
}

export function getRegexByType(type: ChangeTypes, startsWith: boolean = false): string | RegExp {
  const startsWithRegexChar = startsWith ? '^' : '';

  if (type === ChangeTypes.IMAGE) return `${startsWithRegexChar}(\b(https?|ftp|file)://)?[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]`;
}

export function regexMatch(phrase: string, type: ChangeTypes, startsWith: boolean = false): RegExpMatchArray {
  if (type === ChangeTypes.IMAGE) {
    return phrase.toLowerCase().match(new RegExp(getRegexByType(type, startsWith), 'g'));
  }
}
