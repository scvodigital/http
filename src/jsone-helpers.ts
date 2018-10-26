import * as moment from 'moment';

export const JsoneHelpers = {
  default: (value: any, defaultValue: any): any => {
    return value || defaultValue;
  },
  join: (array: any[], glue: string = ', '): string => {
    return Array.isArray(array) ? array.join(glue) : '';
  },
  split: (input: string, separator: string | RegExp = ',', limit: number | undefined): string[] => {
    return input.split(separator, limit);
  },
  numberFormat: (value: number, style: string = 'currency', locale: string = 'en-GB', currency: string = 'GBP'): string => {
    return value.toLocaleString(locale, {
      style: style,
      currency: currency
    });
  },
  dateFormat: (format: string, date?: any): string => {
    return moment(date).format(format);
  },
}