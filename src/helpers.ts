import arrDiff = require('arr-diff');
const deepDiff: any = require('deep-diff');
import stripHtml = require('string-strip-html');
import markdown = require('markdown');
const sqlstring: any = require('sqlstring');
import stringify = require('json-stringify-safe');
import * as jsonata from 'jsonata';
const dot: any = require('dot-object');
import * as moment from 'moment-timezone';
import * as querystring from 'querystring';
const s: any = require('string');
const crypto = require('crypto');
import * as Url from 'url';
import * as util from 'util';
import * as dateMath from '@elastic/datemath';
const JSON6: any = require('json-6');

/* tslint:disable */
export interface Handlebars { registerHelper: (...args: any[]) => void; }
const __switch_stack__: any[] = [];

export class Helpers {
  static handlebars: any;

  static register(hbs: Handlebars) {
    Helpers.handlebars = hbs;
    Object.getOwnPropertyNames(this).forEach((prop: string) => {
      if (prop.indexOf('helper_') === 0) {
        if (typeof (this as any)[prop] === 'function') {
          const name = prop.replace(/helper_/, '');
          hbs.registerHelper(name, (this as any)[prop]);
        }
      }
    });
  }

  static helper_split(str: string, delimiter: string) {
    const parts = !str ? [] : str.split(delimiter);
    return parts;
  }

  static helper_regexSplit(str: string, rgDelimiter: string) {
    var regex = new RegExp(rgDelimiter);
    const parts = !str ? [] : str.split(regex);
    return parts;
  }

  static helper_arrayify(input: any) {
    if (Array.isArray(input)) {
      return input;
    }
    return [input];
  }

  static helper_hash(input: string, algorithm: string) {
    input = input || '';
    algorithm = ['sha1', 'md5'].indexOf(algorithm) > -1 ? algorithm : 'sha1';
    const output = crypto.createHash(algorithm).update(input).digest('hex');
    return output;
  }

  static helper_getKeys(input: any) {
    if (!input) {
      return null;
    }
    return Object.keys(input);
  }

  static helper_getValues(input: any) {
    if (!input) {
      return [];
    }
    return Object.values(input);
  }

  static helper_markdown(input: string) {
    if (!input) {
      return '';
    }

    var html = markdown.markdown.toHTML(input);
    return html;
  }

  static helper_markdownParse(input: string) {
    if (!input) {
      return [];
    }
    var tree = markdown.markdown.parse(input);
    return tree;
  }

  static helper_slice(input: any[], start: number, end: number | undefined) {
    if (!Array.isArray(input)) {
      return [];
    }
    const output = input.slice(start || 0, end || undefined);
    return output;
  }

  static helper_sumArray(input: any[]) {
    if (!Array.isArray(input)) {
      return 0;
    }
    let total: number = 0;
    for (let i=0; i<input.length; i++) {
      if (isNaN(input[i])) {
        continue;
      }
      total += Number(input[i]);
    }
    return total;
  }

  static helper_numberFormat(input: any, localeString: string, precision: number) {
    if ((!input && input !== 0 && input !== '0') || input === true) {
      return '';
    }
    let num: number = Number(input);
    if (typeof precision === 'number') {
      num = Number(num.toFixed(precision));
    }
    return num.toLocaleString(localeString);
  }

  static helper_dotPattern(input: any, path: string) {
    if (!input || !path) {
      return [];
    }

    const output = [];
    const pattern = path.replace(/(\.?)(\*)(\.?)/g, '\$1[^\\.]+\$3');
    const regex = new RegExp(pattern, 'g');
    const flattened = dot.dot(input);

    for (const [path, value] of Object.entries(flattened)) {
      if (regex.test(path)) {
        output.push(value);
      }
    }

    return output;
  }

  static helper_mysqlEscape(input: string, stripQuotes: boolean = false) {
    if (typeof input !== 'string') {
      return '';
    }
    var escaped = sqlstring.escape(input);
    if (typeof stripQuotes === 'boolean' && stripQuotes === true) {
      if (escaped.charAt(0) === '\'') {
        escaped = escaped.substr(1);
      }
      if (escaped.charAt(escaped.length - 1) === '\'') {
        escaped = escaped.substr(0, escaped.length - 1);
      }
    }
    return escaped;
  }

  static helper_firstItem(arr: any[]) {
    if (!arr) return null;
    if (!Array.isArray(arr)) return null;
    if (arr.length === 0) return null;
    return arr[0];
  }

  static helper_lastItem(arr: any[]) {
    if (!arr) return null;
    if (!Array.isArray(arr)) return null;
    if (arr.length === 0) return null;
    return arr[arr.length - 1];
  }

  static helper_slugify(str: string) {
    const slug = s(str.replace(/\//g, '-')).slugify().s;
    return slug;
  }

  static helper_fixUrl(url: string, protocol: string = 'http') {
    if (!url) {
      return '';
    }
    if (url.indexOf('http') === 0) {
      return url;
    }
    if (url.indexOf('//') === 0) {
      return protocol + ':' + url;
    }
    return protocol + '://' + url;
  }

  static helper_parseUrl(urlString: string) {
    try {
      const url = Url.parse(urlString);
      return url;
    } catch (err) {
      console.error('parseUrl Helper -> Invalid input Url', urlString, err);
      return null;
    }
  }

  static helper_dateMath(expression: string) {
    const output: Date = dateMath.parse(expression);
    return output;
  }

  static helper_querystringify(obj: any = {}) {
    const clone = JSON.parse(JSON.stringify(obj));
    const args: IHelperArgs = arguments[1];
    const newObj: any = {};
    if (args && args.hash) {
      Object.assign(clone, args.hash);
    }
    Object.keys(clone).sort().forEach((key) => {
      if (clone[key]) {
        newObj[key] = clone[key];
        if (Array.isArray(newObj[key])) {
          newObj[key].sort();
        }
      }
    });
    const qs = querystring.stringify(newObj);
    return qs;
  }

  static helper_ngStringify(obj: any) {
    let json = JSON.stringify(obj, null, 4);
    json = json.replace(/\{/g, '{{ \'{\' }}');
    return json;
  }

  static helper_jsStringify(obj: any) {
    let json = JSON.stringify(obj, null, 4);
    json = json.replace(/(<\/script)/gi, '</scr" + "ipt');
    return json;
  }

  static helper_blockStringify(context: any, options: any) {
    var block = options.fn(context);
    var json = JSON.stringify(block, null, 4);
    //console.log('BLOCKSTRINGIFY', json);
    return json;
  }

  static helper_safeStringify(obj: any) {
    var json = stringify(obj, null, 4);
    return json;
  }

  static numberLines(text: string) {
    return text.split(/\r?\n/g).map((item: string, index: number) => {
      return `${index + 1}: ${item || ''}`;
    }).join('\n');
  }

  static helper_json(options: Handlebars.HelperOptions) {
    let value = typeof options.hash.value === 'undefined' ? null : options.hash.value
    if (options.fn) {
      const type = options.hash.type || 'object';
      const block = options.fn(this) || '';
      switch (type) {
        case ('array'):
          try {
            value = JSON6.parse('[' + block + ']');
          } catch(err) {
            console.error('Failed to parse json', '\n' + Helpers.numberLines('[\n' + block + '\n]') + '\n', err);
            throw err;
          }
          break;
        case ('object'):
          try {
            value = JSON6.parse('{' + block + '}');
          } catch(err) {
            console.error('Failed to parse json', '\n' + Helpers.numberLines('{\n' + block + '\n}') + '\n', err);
            throw err;
          }
          break;
        case ('number'):
          value = parseInt(block) || -1;
          break;
        case ('boolean'):
          value = Boolean(block) || false;
          break;
        default:
          value = block;
      }
    }
    if (options.hash.key) {
      return stringify(options.hash.key) + ': ' + stringify(value, null, 4);
    } else {
      return stringify(value, null, 4);
    }
  }

  /**
   * Converts data into form which is acceptable under CSV. Adapted from
   * @param obj
   */
  static helper_csvStringify(obj:any, separator: string){
    if (!separator) separator = ",";
    var specialChars = new RegExp('["\r\n' + separator + ']', 'gm');

    if (obj === undefined || obj ===  null || obj === "null") {
      obj = '';
    }
    if (typeof obj != 'string') {
      var s = obj.toString();
      if (s == '[object Object]') {
        obj = JSON.stringify(obj);
        if (obj == '{}') {
          obj = '';
        }
      }
      else {
        obj = s;
      }
    }
    else if (obj.search(specialChars)) {
      obj = '"' + obj.replace("'", '""') + '"';
    }
    return obj;
  }


  static helper_eachJoin(input: any[], separator: string, options: any) {
    var items: string[] = [];

    for (var i = 0; i < input.length; i++) {
      items.push(options.fn(input[i]));
    }

    items = items.filter((item: string) => {
      return !!item.replace(/\s|\r|\n/gi, '');
    });

    var out = items.join(', ');
    return out;
  }


  static helper_eachMap(input: any, options: any) {
    if (!input) return null;
    var output = [];
    var entries = (Object as any).entries(input);
    var count = entries.length;
    var current = 0;
    for (const [key, value] of entries) {
      var context = {
        '@key': key,
        '@value': value,
        '@first': current === 0,
        '@last': current === count - 1
      };
      output.push(options.fn(context));
      current++;
    }
    return output.join('\n');
  }

  static helper_shuffle(input: any[]) {
    if (!Array.isArray(input)) {
      return [];
    }
    const output = JSON.parse(JSON.stringify(input));
    return output.sort((a: any, b: any) => { return Math.round(Math.random()); });
  }

  static helper_arrayConcat() {
    var output = [];
    for (var i = 0; i < arguments.length; ++i) {
      if (Array.isArray(arguments[i])) {
        output.push(...arguments[i]);
      }
    }
    return output;
  }

  static helper_indexOf(haystack: any[], needle: any): number|null {
    if (!Array.isArray(haystack)) {
      return null;
    }
    return haystack.indexOf(needle);
  }

  static helper_inflect(count: number, singular: any, plural: any, includeCount: boolean) {
    var word = (count > 1 || count === 0) ? plural : singular;
    if (includeCount === true) {
      return String(count) + ' ' + word;
    } else {
      return word;
    }
  };

  static helper_toFixed(input: number|string, precision: number = 2) {
    try {
      const parsed = Number(input);
      const output = parsed.toFixed(precision);
      return output;
    } catch(err) {
      return null;
    }
  }

  static helper_itemAt(haystack: any[], index: number): any {
    if (!Array.isArray(haystack) || typeof index !== 'number') {
      return null;
    }
    if (index >= haystack.length) {
      return null;
    }
    return haystack[index];
  }

  static helper_corresponding(source: any[], target: any[], item: any): any {
    if (!Array.isArray(source) || !Array.isArray(source) || !item) {
      return null;
    }

    const srcIndex = source.indexOf(item);

    if (srcIndex === -1 || srcIndex >= target.length) {
      return null;
    }

    return target[srcIndex];
  }

  static helper_contains(haystack: any[]|string, val: any) {
    if (!Array.isArray(haystack) && typeof haystack !== 'string') {
      return false;
    }

    if (typeof val === 'string' || typeof val === 'number') {
      return (haystack as string).indexOf((val as string)) > -1;
    }

    for (let i = 0; i < haystack.length; ++i) {
      const item = haystack[i];
      const diff = deepDiff.diff(item, val);

      //console.log(
      //  '\n#### TEST', i, '####\n',
      //  'LHS:', item, '\n',
      //  'RHS:', val, '\n',
      //  'DIFF:', diff
      //);

      if (!diff) {
        return true;
      }
    }

    return false;
  }

  static helper_containsAny(haystack: any[], vals: any[]) {
    if (!Array.isArray(haystack) || !vals) {
      return false;
    }

    vals = Helpers.helper_arrayify(vals);

    for (var v = 0; v < vals.length; v++) {
      if (Helpers.helper_contains(haystack, vals[v])) {
        return true;
      }
    }

    return false;
  }

  static helper_obj(options: any) {
    //console.log(options);
    return options.hash;
  }

  static helper_parse(str: string) {
    //console.log('Parsing:', str);
    const obj = JSON.parse(str);
    return obj;
  }

  static helper_querystring(str: string, sep: string = '&', eq: string = '=') {
    if (typeof str !== 'string') {
      return {};
    }
    try {
      const out = querystring.parse(str);
      return out;
    } catch (err) {
      console.error(
        'Handlebars helper "querystring" failed to parse the following string:',
        str, err);
        return {};
      }
    }

    static helper_arrMatch(src: any[], dst: any[]) {
      if (!src && !dst) {
        return true;
      }
      if (!src || !dst) {
        return false;
      }

      src = Array.isArray(src) ? src : [src];
      dst = Array.isArray(dst) ? dst : [dst];

      let srcItems: any[] = [];
      let dstItems: any[] = [];

      src.forEach((item: any) => {
        if (item && srcItems.indexOf(item) === -1) {
          srcItems.push(item);
        }
      });
      srcItems.sort();
      dst.forEach((item: any) => {
        if (item && dstItems.indexOf(item) === -1) {
          dstItems.push(item);
        }
      });
      dstItems.sort();

      const diff = arrDiff(srcItems, dstItems);

      return diff.length === 0;
    }

    static helper_keyValue(obj: any) {
      if (!obj) {
        return [];
      }
      const props: Array < {
        key: string;
        value: any
      }
      > = [];
      Object.keys(obj).forEach((key: string) => {
        props.push({key, value: obj[key]});
      });
      return props;
    }

    static helper_moment(date: any = null, format = '') {
      if (!date) {
        return moment();
      } else if (!format) {
        return moment(date);
      } else {
        return moment(date, format);
      }
    }

    static helper_momentDistance(date1: any, date2: any, measurement: string) {
      date1 = date1 || moment();
      date2 = date2 || moment();
      measurement = measurement || 'days';
      return date1.diff(date2, measurement);
    }

    static helper_momentFromNow(date: any) {
      return moment(date).fromNow();
    }

    static helper_momentStartOf(date: moment.Moment, what: string) {
      if (!what) {
        what = 'month';
      }
      if (!date) {
        date = moment();
      }
      return date.startOf(what as moment.unitOfTime.StartOf);
    }

    static helper_momentEndOf(date: moment.Moment, what: string) {
      if (!what) {
        what = 'month';
      }
      if (!date) {
        date = moment();
      }
      return date.endOf(what as moment.unitOfTime.StartOf);
    }

    static helper_momentFormat(date: moment.Moment, format = '') {
      if (!format) {
        return date.format();
      } else {
        return date.format(format);
      }
    }

    static helper_momentConvertTz(input: moment.Moment, inputTz: string, outputTz: string) {
      if (!input || !input.format) return null;
      try {
        inputTz = typeof inputTz === 'string' ? inputTz : 'UTC';
        outputTz = typeof outputTz === 'string' ? outputTz : 'Europe/London';
        const date = moment.tz(input, inputTz);
        date.tz(outputTz);
        return date;
      } catch(err) {
        return null;
      }
    }

    static helper_atob(b64: string) {
      try {
        const buff = Buffer.from(b64, 'base64');
        const str = buff.toString('ascii');
        return str;
      } catch (err) {
        return '';
      }
    }

    static helper_btoa(str: string) {
      const buff = Buffer.from(str);
      const b64 = buff.toString('base64');
      return b64;
    }

    static helper_removeEntities(str: string) {
      const out = s(str).decodeHTMLEntities().s;
      return out;
    }

    static helper_decodeURIComponent(str: string) {
      if (!str) return '';
      console.log('DECODE URI COMPONENT BEFORE:', str);
      const out = decodeURIComponent(str);
      console.log('DECODE URI COMPONENT AFTER:', out);
      return out;
    }

    static helper_encodeURIComponent(str: string) {
      if (!str) return '';
      const out = encodeURIComponent(str);
      return out;
    }

    static helper_decodeURI(str: string) {
      if (!str) return '';
      const out = decodeURI(str);
      return out;
    }

    static helper_encodeURI(str: string) {
      if (!str) return '';
      const out = encodeURI(str);
      return out;
    }

    static helper_thisToThat(input: string, map: string, defaultVal: string) {
      if (!input || !map) return '';
      const parsed = querystring.parse(map);
      for (const [key, value] of Object.entries(parsed)) {
        if (input === key) {
          return value;
        }
      }
      return defaultVal;
    }

    static helper_getProps(arr: any[], props: string[]) {
      const out: any[] = [];

      arr.forEach((item: any) => {
        const newItem: any = {};
        props.forEach((prop) => {
          newItem[prop] = item[prop];
        });
        out.push(newItem);
      });

      return out;
    }

    static helper_getProperty(obj: any, path: string) {
      if (!obj || !path) {
        return null;
      }
      // console.log('Looking for "', path, '"');
      const val = dot.pick(path, obj);
      return val;
    }

    static helper_dot(path: string, options: any) {
      if (typeof path !== 'string') {
        return null;
      }
      const val = dot.pick(path, options.data.root);
      return val;
    }

    static helper_getType(obj: any) {
      if (Array.isArray(obj)) {
        return 'array';
      }
      return typeof obj;
    }

    static helper_substr(input: string, from: number, length: number|undefined) {
      if (typeof input !== 'string') return input;
      if (typeof from !== 'number') from = 0;
      if (typeof length !== 'number') length = undefined;
      return input.substr(from, length);
    }

    static helper_substring(input: string, start: number, end: number|undefined) {
      if (typeof input !== 'string') return input;
      if (typeof start !== 'number') start = 0;
      if (typeof end !== 'number') end = undefined;
      return input.substring(start, end);
    }

    static helper_raw(options: any) {
      return options.fn(this);
    }

    static helper_regexReplace(
      input: string, expression: string, options: string, replace: string) {
        if (typeof input !== 'string') {
          return input;
        }
        const regex = new RegExp(expression, options);
        const output = input.replace(regex, replace);
        return output;
      }

      static helper_regexMatch(input: string, expression: string, options: string) {
        if (typeof input !== 'string') {
          return input;
        }
        const regex = new RegExp(expression, options);
        const output = regex.test(input);
        //console.log('REGEX MATCH -> input:', input, '| expression:', regex, '| options:', options, '| output:', output);
        return output;
      }

      static helper_reverse(input: any[]) {
        if (!Array.isArray(input)) {
          return [];
        }
        const reversed = [];
        for (var i = input.length; i  >= 0; --i) {
          reversed.push(input[i]);
        }
        return reversed;
      }

      static helper_uppercase(input: any) {
        if (typeof input !== 'string') {
          return input;
        } else {
          return input.toUpperCase();
        }
      }

      static helper_stripTags(html: string) {
        if (!html) {
          return '';
        }
        return stripHtml(html);
      }

      static helper_stripTrailingSlash(input: string) {
        if (typeof input === 'string' && input.endsWith('/')) {
          return input.substr(0, input.length - 1);
        } else {
          return input;
        }
      }

      static helper_minimum() {
        try {
          let minimum: number|null = null;
          for (let input of Array.from(arguments)) {
            if (Number.isInteger(input)) {
              if (minimum === null || minimum > input) {
                minimum = input;
              }
            }
          }
          return minimum;
        } catch(err) {
          console.error('Minimum Helper ->', err);
          return null;
        }
      }

      static helper_maximum() {
        try {
          let maximum: number|null = null;
          for (let input of Array.from(arguments)) {
            if (Number.isInteger(input)) {
              if (maximum === null || maximum < input) {
                maximum = input;
              }
            }
          }
          return maximum;
        } catch(err) {
          console.error('Maximum Helper ->', err);
          return null;
        }
      }

      static helper_customPaginate(value: number, maximum: number, innerRange: number, outerRange: number) {
        if (!innerRange) innerRange = 2;
        if (!outerRange) outerRange = 2;
        const pagerefs = [];
        for (var x = 1; x < maximum; x++){
          if (x <= outerRange && x <= value) pagerefs.push(x);
          else if (Math.abs(value - (x)) <= innerRange) pagerefs.push(x);
          else if (x >= maximum - outerRange) pagerefs.push(x);
          else if (x < value) {
            pagerefs.push("...");
            x = value - innerRange - 1;
          }
          else if (x > value) {
            pagerefs.push("...");
            x = maximum - outerRange - 1;
          }
        }
        return pagerefs;
      }


      static helper_stripDomains(input: string, domains: string[]) {
        if (typeof input !== 'string' || !Array.isArray(domains)) {
          return input;
        }
        domains = domains.filter(domain => typeof domain === 'string');
        domains = domains.map((domain: string) => domain.replace(/\./g, '\\.'));
        const domainRegex = '((https?)?:\\/\\/)((' + domains.join(')|(') + '))';
        const domainStripper = new RegExp(domainRegex, 'ig');
        const output = input.replace(domainStripper, '');
        return output;
      }

      static helper_length(input: any[]|string) {
        if (typeof input !== 'string' && !Array.isArray(input)) {
          return -1;
        }
        return input.length;
      }

      static helper_any(input: any[]) {
        if (!Array.isArray(input)) {
          return false;
        }
        return input.length > 0;
      }

      static helper_entries(input: any) {
        if (typeof input !== 'object') {
          return [];
        }
        return Object.entries(input);
      }

      static helper_pluck(items: any[], path: string) {
        if (typeof path !== 'string' || !Array.isArray(items)) {
          return null;
        }
        const output: any[] = [];
        items.forEach(item => {
          const val = dot.pick(path, item);
          output.push(val);
        });

        return output;
      }

      static helper_flatten(items: any[]) {
        if (!Array.isArray(items)) {
          return null;
        }

        var output: any[] = [];
        items.forEach(item => {
          if (Array.isArray(item)) {
            output.push(...item);
          } else {
            output.push(item);
          }
        });

        return output;
      }

      static helper_distinct(items: any[]) {
        if (!Array.isArray(items)) {
          return null;
        }
        const output: any[] = [];
        items.forEach(item => {
          if (output.indexOf(item) === -1) {
            output.push(item);
          }
        });
        return output;
      }

      static helper_groupBy(input: any[], field: string) {
        if (!Array.isArray(input) || !field) return {};

        const output: any = {};
        for (const item of input) {
          if (!item || typeof item !== 'object') continue;
          const key = (value => {
            if (value === null) return 'null';
            switch (typeof value) {
              case ('string'): return value;
              case ('number'): return value;
              case ('boolean'): return value.toString();
              default: return typeof value;
            }
          })(dot.pick(field, item));

          output[key] ? output[key].push(item) : output[key] = [item];
        }

        return output;
      }

      static helper_jsonata(input: any, expression: string) {
        if (!input || typeof expression !== 'string') return {};
        try {
          const compiled = jsonata(expression);
          const output = compiled.evaluate(input);
          return output;
        } catch (err) {
          console.error('JSONata Helper ->', expression, err);
          return {};
        }
      }

      static helper_unique(input: any[], property: string) {
        if (!Array.isArray(input)) {
          return null;
        }

        const tests: any[] = [];
        const output: any[] = [];

        for (const item of input) {
          const test = typeof property === 'string' ? dot.pick(property, item) : item;
          if (!tests.includes(test)) {
            tests.push(test);
            output.push(item);
          }
        }

        return output;
      }

      static helper_filter(items: any[], property: string, comparator: string, test: any) {
        const found: any[] = [];
        items.forEach(item => {
          const value: any = property === null ? item : dot.pick(property, item);
          let match = false;
          try {
            switch (comparator) {
              case ('==='): match = value === test;
              break;
              case ('=='): match = value == test;
              break;
              case ('>='): match = value >= test;
              break;
              case ('>'): match = value > test;
              break;
              case ('<='): match = value <= test;
              break;
              case ('<'): match = value < test;
              break;
              case ('testIn'): match = value.indexOf(test) > -1;
              break;
              case ('valueIn'): match = test.indexOf(value) > -1;
              break;
              case ('testNotIn'): match = value.indexOf(test) === -1;
              break;
              case ('valueNotIn'): match = test.indexOf(value) === -1;
              break;
              case ('exists'): match = !!property;
            }
          } catch(err) { }
          if (match) {
            found.push(item);
          }
        });
        return found;
      }

      static helper_sort(items: any[]) {
        if (!Array.isArray(items)) {
          return items;
        }
        const out = items.sort();
        return out;
      }

      static helper_sortBy(items: any[], property: string, direction: string) {
        if (['asc', 'desc'].indexOf(direction) === -1) {
          direction = 'asc';
        }
        const clone = JSON.parse(JSON.stringify(items));
        clone.sort((a: any, b :any) => {
          const valA = property ? dot.pick(property, a) || 0 : a;
          const valB = property ? dot.pick(property, b) || 0 : b;
          return direction === 'asc' ? valA - valB : valB - valA;
        });
        return clone;
      }

      static helper_withExtend(context: any) {
        const args: IHelperArgs = arguments[1];
        if (args.hash && Object.keys(args.hash).length > 0) {
          for (const key of Object.keys(args.hash)) {
            context[key] = args.hash[key];
          }
        }
        return args.fn(context);
      }

      static helper_sortByIndex(items: any[], index: any[], property: string) {
        if (!Array.isArray(items) || !Array.isArray(index) || typeof property !== 'string') {
          return items;
        }

        var clone: any[] = (JSON.parse(JSON.stringify(items)) as any[]);

        clone.sort((a: any, b: any) => {
          var prop1 = dot.pick(property, a);
          var prop2 = dot.pick(property, b);

          var ind1 = index.indexOf(prop1);
          var ind2 = index.indexOf(prop2);

          ind1 = ind1 > -1 ? ind1 : Math.max(items.length, index.length) + 1;
          ind2 = ind2 > -1 ? ind2 : Math.max(items.length, index.length) + 1;

          return ind1 - ind2;
        });

        return clone;
      }

      static helper_component(partialName: string, options: any) {
        if (typeof partialName !== 'string' ||
        !Helpers.handlebars.partials.hasOwnProperty(partialName)) {
          return null;
        }
        const partial = Helpers.handlebars.partials[partialName];
        const template = Helpers.handlebars.compile(partial);
        const html = template(options);
        return new Helpers.handlebars.SafeString(html)
      }

      static helper_log(message: string, obj: any) {
        console.log('####', message, '->', obj);
      }

      static helper_switch(value: any) {
        var args = Array.from( arguments );
        var options = args.pop();
        __switch_stack__.push({
          switch_match : false,
          switch_value : value
        });
        var html = options.fn( this );
        __switch_stack__.pop();
        return html;
      }

      static helper_case(value: any) {
        var args = Array.from( arguments );
        var options = args.pop();
        var caseValues = args;
        var stack = __switch_stack__[__switch_stack__.length - 1];
        if ( stack.switch_match || caseValues.indexOf( stack.switch_value ) === -1 ) {
          return '';
        } else {
          stack.switch_match = true;
          return options.fn( this );
        }
      }

      static helper_switchDefault() {
        var args = Array.from( arguments );
        var options = args.pop();
        var stack = __switch_stack__[__switch_stack__.length - 1];
        if ( !stack || !stack.switch_match ) {
          return options.fn( this );
        }
        return '';
      }

      static helper_elseIfBlock(options: Handlebars.HelperOptions) {
        try {
          options.data['@elseIf'] = options.data['@elseIf'] || [];
          options.data['@elseIf'].push(false);

          let output = options.fn(options.data);
          const level = options.data['@elseIf'].length - 1;

          if (options.data['@elseIf'][level] === false) {
            if (options.inverse) {
              output = options.inverse(options.data);
            } else {
              output = '';
            }
          }

          options.data['@elseIf'].pop();
          if (options.data['@elseIf'].length === 0) {
            delete options.data['@elseIf'];
          }
          return output;
        } catch(err) {
          console.error('ElseIfBlock Failed', (options.data['@elseIf'] || 'No @elseIf'), err);
          return '';
        }
      }

      static helper_elseIf(value: any) {
        var args = Array.from(arguments);
        var options: Handlebars.HelperOptions = args.pop();
        try {
          const level = options.data['@elseIf'].length - 1;
          if (options.data['@elseIf'][level] === true) {
            return '';
          }

          if (!!value) {
            options.data['@elseIf'][level] = true;
            return options.fn(options.data);
          } else {
            return '';
          }
        } catch(err) {
          console.error('ElseIf Failed', (options.data['@elseIf'] || 'No @elseIf'), err);
          return '';
        }
      }
    }

    export interface IHelperArgs {
      name: string;
      hash: any;
      data: any;
      fn: (...args: any[]) => any;
    }
    /* tslint:enable */