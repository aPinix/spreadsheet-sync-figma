// types --------------------

export type LayerNameSuffix = string | number;



// enums --------------------

export const enum ChangeTypes {
  COLOR_FILL = 'color-fill',
  COLOR_STROKE = 'color-stroke',
  SHOW_HIDE = 'show-hide',
  IMAGE = 'image',
  VARIANT = 'variant',
  TEXT = 'text',
}

export const enum UrlDataType {
  SHEET = 'sheet',
  VALUES = 'values',
}

export const enum RequestType {
  SUCCESS = 'success',
  ERROR = 'error',
  RESET = 'reset',
}

export const enum SuffixSpecial {
  RANDOM = 'rand',
  RANDOM_SAVE = 'randsave',
}

export const enum RequestMessage {
  INVALID_LINK = '⛔️ Invalid link or bad request',
  SHEET_NOT_PUBLIC = '⛔️ Sheet is not Public',
  SHEET_PUBLIC = '✅ Sheet is Public',
  ERROR_GENERIC = '⛔️ Something went wrong!',
}



// interfaces --------------------

export interface UrlData {
  url: string;
  type: UrlDataType;
}

export interface TextHasPlaceholders {
  hasPlaceholders: boolean;
  placeholders: any[];
  phrase: string;
}
