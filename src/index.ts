/**
 * START: Node imports
 * @region
 */
// Node Imports
import * as Http from 'http';
import * as Https from 'https';
import * as Url from 'url';
import * as Querystring from 'url';
import * as Path from 'path';
import * as Fs from 'fs';
import { exec as Exec, execSync as ExecSync, spawn as Spawn, ChildProcess } from 'child_process'

// Internal Imports
import { CONFIG } from './config';
import { Map } from './interfaces';
import { Helpers } from './helpers';
import { JsoneHelpers } from './jsone-helpers';
import { Err as Error } from './err';

// External Imports
import * as Globby from 'globby';
import * as Firebase from 'firebase-admin';
const HbsFactory = require('clayhandlebars');
const Handlebars = require('handlebars');
import * as Chokidar from 'chokidar';
const Stringify = require('json-stringify-safe');
import * as Mime from 'mime';
import * as Cookie from 'cookie';
import * as Pako from 'pako';
const IsGzip = require('is-gzip');
import * as GetBody from 'get-body';
import { BristlesFactory } from 'bristles';

require('source-map-support').install();

// Router Imports
import {
  Router, RouterConfiguration, RouterRequest, RouterResponse,
  HttpVerb, RendererHandlebars, RendererJsone, TaskElasticsearch,
  TaskMySQL, TaskRedirect, TaskRenderLayout, TaskRequest, TaskCacheFlush,
  TaskRender, TaskFirebaseAuth, TaskFirebaseGetUser, TaskFirebaseGetSession,
  TaskFirebaseRtbGet, TaskReroute, TaskFirebaseRtbSet, TaskTransform,
  TaskMailgun, TaskGeneratePdf, TaskGAGet, TaskGASet, TaskSalesforceBulk,
  TaskSalesforceApex
} from '@scvo/router';
/**
 * END: Node imports
 * @region
 */

/**
 * START: Application constants
 * @region
 */
const HTTP_PORT: number = Number(process.env.PORT) || CONFIG.defaultHttpPort;
const LIVE: boolean = !!process.env.GAE_SERVICE;
const FIREBASE_SITES_PATH: string = CONFIG.firebasePath;
const SITES_GLOB: string = Path.join(CONFIG.localSitesDir, '*/build/config.json')
/**
 * END: Application constants
 * @region
 */

/**
 * START: Global variables
 * @region
 */
// Setup Firebase apps
const firebaseApps: { [name: string]: Firebase.app.App } = {};
for (const [name, config] of Object.entries(CONFIG.firebaseAccounts)) {
  firebaseApps[name] = Firebase.initializeApp({
    databaseURL: config.databaseURL,
    credential: Firebase.credential.cert(config.credential as Firebase.ServiceAccount)
  }, name);
}
const firebase = firebaseApps[CONFIG.defaultFirebaseAccount];

// The map our Router instances are stored in
let routers: Map<Router> | null = null;

// A map of domain names each router instance should handle incoming requests from
let domainMap: Map<string> = {};

/**
 * END: Global variables
 * @region
 */

const webpackThreads: { [site: string]: ChildProcess } = {};

/*
 * Setup auto reload of site configurations
 */
if (LIVE) {
  // Get a reference to the Firebase RTDB at the given path
  const ref = firebase.database().ref(FIREBASE_SITES_PATH);

  // Watch for any value changes to site configurations that occur under the given path
  ref.on('value', async (snapshot: Firebase.database.DataSnapshot | null) => {
    console.log('FIREBASE WATCHER -> Sites configurations changed, reloading routers');
    // If there is a change, reload the routers
    await reloadRouters();
  });
} else {
  // if (process.env.SITES) {
  //   for (const site of process.env.SITES.split(/\s*,\s*/g)) {
  //     const path = Path.join(CONFIG.localSitesDir, site);
  //     console.log(`Spawning process for '${site}' in ${path}`);
  //     const process = Exec('npm start', {
  //       cwd: path
  //     });
  //     process.on('error', (err) => {
  //       console.error(`Site '${site}' webpack process threw an error`, err);
  //     });
  //     process.on('close', (code, signal) => {
  //       console.error(`Site '${site}' webpack process closed.\n\tCode: ${code}\n\tSignal: ${signal}`);
  //     });
  //     webpackThreads[site] = process;
  //   }
  // }

  // setTimeout(() => {
    // Setup a file watcher to look out for changes to local site configuration files
    const watcher = Chokidar.watch(SITES_GLOB, {
      awaitWriteFinish: true,

    });
    console.log('FILEWATCHER -> Monitoring the following glob for changes:', SITES_GLOB);

    // Create a 'change' event handler for the file watcher
    watcher.on('change', async (path: string) => {
      console.log('FILEWATCHER -> Site configurations changed, reloading routers');
      try {
        // If there is a change, reload the routers
        await reloadRouters();
        ExecSync('notify-send -a "SCVO Router" -t 10000 -u normal "Sites reloaded"');
      } catch(err) {
        console.error('Failed to reload routers:', err);
      }
    });

    watcher.on('add', async (path: string) => {
      console.log('FILEWATCHER -> Site configurations changed, reloading routers');
      try {
        // If there is a change, reload the routers
        await reloadRouters();
        ExecSync('notify-send -a "SCVO Router" -t 10000 -u normal "Sites reloaded"');
      } catch(err) {
        console.error('Failed to reload routers:', err);
      }
    });
  // }, 15000);
}

/*
 * Deletes and unsets all instances of the router and cleans up the domain map
 */
function clearRouters() {
  if (routers) {
    for (var name in routers) {
      delete routers[name];
    }
    console.log('Cleared Routers:', Object.keys(routers));
  }

  routers = {};
  domainMap = {};
}

/*
 * Loads all router configurations from either Firebase or Locally depending on the environment
 */
async function reloadRouters() {
  try {
    // Clear current router instances
    clearRouters();
    routers = {};

    // Create a map for our configurations to be loaded into
    let sites: Map<RouterConfiguration> = {};

    // Get an instance of all task modules to use in each router instance
    const taskModules = createTaskModules();

    // If we are live (on AppEngine)
    if (LIVE) {
      // Get a reference to our Firebase RTDB at the given path
      const ref = firebase.database().ref(FIREBASE_SITES_PATH);

      // Get the site configuration data from that path
      const sitesSnapshot = await ref.once('value');

      // If there is no data, report an error and return
      if (!sitesSnapshot.exists()) {
        console.error('Sites configurations do not exist in Firebase at:', FIREBASE_SITES_PATH);
        return;
      }

      // Stick the data in our sites map
      sites = sitesSnapshot.val() as Map<RouterConfiguration>;
    // If we are not live (running in a development environment)
    } else {
      console.log('Loading routers locally using this glob:', SITES_GLOB);

      let sitesPaths: string[] = [];
      try {
        // Get the paths of all site configuration files from the assets build directory
        sitesPaths = await Globby(SITES_GLOB, {
          ignore: ['**/node_modules/**']
        });
      } catch (err) {
        console.error('Failed to get local site configs', err);
      }

      // Loop through each of these site configuration files
      for (const sitePath of sitesPaths) {
        // Work out the site name from the file name
        const siteDir = sitePath.replace('/build/config.json', '');
        const siteName = Path.basename(siteDir);

        console.log('Loading site:', siteName, 'from', sitePath);

        // Read the site configuration into a variable and add it to our sites map
        const siteJson = Fs.readFileSync(sitePath).toString();
        sites[siteName] = JSON.parse(siteJson);
      }
    }

    // Loop through each of the configurations in the sites map
    for (const [name, config] of Object.entries(sites)) {
      try {
        // Create Renderer instances to be used in the site's router instances
        const renderers = {
          handlebars: createHandlebarsRenderer(config.metaData.handlebars.partials),
          bristles: createBristlesRenderer(config.metaData.handlebars.partials),
          jsone: new RendererJsone(JsoneHelpers)
        };

        // Add each of the site's domains to the domain map
        for (const domain of config.domains) {
          domainMap[domain] = name;
        }

        // Inject live/dev helper properties to the site's metaData
        config.metaData.live = LIVE;
        config.metaData.dev = !LIVE;

        // Create the new router instance and store it in our global router map
        routers[name] = new Router(config, taskModules, renderers);
      } catch(err) {
        console.error(`Site '${name}' failed to load`, err);
      }
    }

    console.log('Routers reloaded:', domainMap);
  } catch(err) {
    throw new Error('Failed to reload routers', err);
  }
}

function createBristlesRenderer(partials: Map<string>): RendererHandlebars {
  const hbsEnv = Handlebars.create();
  const bristles = BristlesFactory(hbsEnv);
  for (const [name, partial] of Object.entries(partials)) {
    bristles.registerPartial(name, partial);
  }
  return new RendererHandlebars(bristles);
}

/*
 * Creates an instance of the Handlebars renderer that has all of our custom helpers
 * registered in it
 */
function createHandlebarsRenderer(partials: Map<string>): RendererHandlebars {
  const hbsEnv = Handlebars.create();
  const hbs = HbsFactory(hbsEnv);
  Helpers.register(hbs);
  for (const [name, partial] of Object.entries(partials)) {
    hbs.registerPartial(name, partial);
  }
  return new RendererHandlebars(hbs);
}

/*
 * Create a map of all the task modules we'll need to setup each router instance
 */
function createTaskModules(): Map<any> {
  const routerTaskModules = {
    elasticsearch: new TaskElasticsearch(),
    redirect: new TaskRedirect(),
    mysql: new TaskMySQL(CONFIG.mysqlAccounts),
    render: new TaskRender(),
    renderLayout: new TaskRenderLayout(),
    firebaseAuth: new TaskFirebaseAuth(firebaseApps),
    firebaseGetUser: new TaskFirebaseGetUser(firebaseApps),
    firebaseGetSession: new TaskFirebaseGetSession(firebaseApps),
    firebaseRtbGet: new TaskFirebaseRtbGet(firebaseApps),
    firebaseRtbSet: new TaskFirebaseRtbSet(firebaseApps),
    generatePdf: new TaskGeneratePdf({
      Roboto: {
        normal: Path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
        bold: Path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
        italics: Path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
        bolditalics: Path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
      },
      Montserrat: {
        thin: Path.resolve(__dirname, '../fonts/Montserrat-Thin.ttf'),
        extralight: Path.resolve(__dirname, '../fonts/Montserrat-ExtraLight.ttf'),
        light: Path.resolve(__dirname, '../fonts/Montserrat-Light.ttf'),
        normal: Path.resolve(__dirname, '../fonts/Montserrat-Regular.ttf'),
        medium: Path.resolve(__dirname, '../fonts/Montserrat-Medium.ttf'),
        semibold: Path.resolve(__dirname, '../fonts/Montserrat-SemiBold.ttf'),
        bold: Path.resolve(__dirname, '../fonts/Montserrat-Bold.ttf'),
        extrabold: Path.resolve(__dirname, '../fonts/Montserrat-ExtraBold.ttf'),
        black: Path.resolve(__dirname, '../fonts/Montserrat-Black.ttf'),
        thinitalics: Path.resolve(__dirname, '../fonts/Montserrat-ThinItalic.ttf'),
        extralightitalics: Path.resolve(__dirname, '../fonts/Montserrat-ExtraLightItalic.ttf'),
        lightitalics: Path.resolve(__dirname, '../fonts/Montserrat-LightItalic.ttf'),
        normalitalics: Path.resolve(__dirname, '../fonts/Montserrat-Italic.ttf'),
        mediumitalics: Path.resolve(__dirname, '../fonts/Montserrat-MediumItalic.ttf'),
        semibolditalics: Path.resolve(__dirname, '../fonts/Montserrat-SemiBoldItalic.ttf'),
        bolditalics: Path.resolve(__dirname, '../fonts/Montserrat-BoldItalic.ttf'),
        extrabolditalics: Path.resolve(__dirname, '../fonts/Montserrat-ExtraBoldItalic.ttf'),
        blackitalics: Path.resolve(__dirname, '../fonts/Montserrat-BlackItalic.ttf')
      },
      "Consolas": {
        normal: Path.resolve(__dirname, '../fonts/Consolas.ttf')
      },
      "Sonder-Sans3": {
        normal: Path.resolve(__dirname, '../fonts/Sonder-Sans3.ttf'),
        bold: Path.resolve(__dirname, '../fonts/Sonder-Sans3.ttf')
      }
    }),
    transform: new TaskTransform({ querystring: Querystring, url: Url }),
    mailgun: new TaskMailgun(CONFIG.mailgunAccounts),
    request: new TaskRequest(CONFIG.requestSecrets),
    gaGet: new TaskGAGet(CONFIG.googleAccounts),
    gaSet: new TaskGASet(),
    salesforceBulk: new TaskSalesforceBulk(CONFIG.salesforceAccounts),
    salesforceApex: new TaskSalesforceApex(CONFIG.salesforceAccounts),
    reroute: new TaskReroute(),
    cacheFlush: new TaskCacheFlush(),
  };
  return routerTaskModules;
}

/*
 * Create out base handler for all incoming requests
 */
const requestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  if (request.url && request.url.startsWith('/assets/')) {
    await assetsRequestHandler(request, response);
  } else if (request.url && request.url.startsWith('/emailer/process-proxy')) {
    await emailerRequestHandler(request, response);
  } else if (request.url && request.url.startsWith('/readiness_check')) {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    response.end('Readiness check, OK!');
  } else if (request.url && request.url.startsWith('/liveness_check')) {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    response.end('Liveness check, OK!');
  } else {
    await routerRequestHandler(request, response);
  }
}

/*
 * Handle any incoming requests for anything in '/assets/'.
 * Return files from CONFIG.localSitesDir/{{requested site}}/*
 * This should never happen in live
 */
const assetsRequestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  try {
    // Get the site name of the incoming request
    const siteName = getRequestSiteName(request);

    // Work out the path to the requested file
    const url = (request.url as string).split('/assets/')[1];
    const path = Path.join(CONFIG.localSitesDir, siteName, 'build', url || '');

    // Get a stat object to get the length of the file
    const stat = Fs.statSync(path);

    // Find out its mime type
    const contentType = Mime.getType(path) || 'text/plain';

    // Is the file GZipped
    const gzipped = IsGzip(Fs.readFileSync(path));

    // Prepare our response headers
    const head: any = {
      'Content-Type': contentType,
      'Content-Length': stat.size
    };

    // If the file is GZipped then add the appropriate content encoding
    if (gzipped) {
      head['Content-Encoding'] = 'gzip';
    }

    //if ('scvo-proxy' in request.headers) {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Request-Method', '*');
      response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
      response.setHeader('Access-Control-Allow-Headers', '*');
    //}

    // Send the headers
    response.writeHead(200, head);

    // Pipe the file into the response
    Fs.createReadStream(path).pipe(response);
  } catch(err) {
    if (request.url && !request.url.endsWith('.map')) {
      //console.error('Failed to get asset', err, request.url);
    }
    response.statusCode = 404;
    response.end(Stringify(err, null, 4));
  }
}

/*
 * Handle all requests that must go to the router
 */
const routerRequestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  try {
    // If no routers are loaded, load them
    if (!routers) {
      await reloadRouters();
    }

    // Ignore requests to /favicon.ico
    if (request.url === '/favicon.ico') {
      response.statusCode = 200;
      response.end('');
      return;
    }

    // If there are still no routers, something must be wrong
    if (!routers) {
      response.statusCode = 500;
      response.end('Routers could not be loaded');
      return;
    }

    // Get some properties from the request to create our router request object
    const secure: null | boolean = !request.headers.hasOwnProperty('x-forwarded-proto') ? null : request.headers['x-forwarded-proto'] === 'https';
    const host = request.headers.host as string || 'localhost';
    const hostname = host.split(':')[0];
    let fullUrl = 'https://' + host + request.url;
    if (fullUrl.lastIndexOf('/') === fullUrl.length - 1) {
      fullUrl = fullUrl.substr(0, fullUrl.length - 1);
    }

    const userAgent = request.headers['user-agent'] || '';
    const appEngine = userAgent.toLowerCase().indexOf('appengine') > -1

    let clientIp = request.connection.remoteAddress || request.socket.remoteAddress || '0.0.0.0';

    if (Array.isArray(request.headers['x-forwarded-for'])) {
      clientIp = request.headers['x-forwarded-for'][0] || clientIp;
    } else if (typeof request.headers['x-forwarded-for'] === 'string') {
      clientIp = request.headers['x-forwarded-for'] || clientIp;
    }

    // If the request is not secure, redirect to HTTPS url generated above
    if (secure === false && !appEngine) {
      response.statusCode = 301;
      response.setHeader('Location', fullUrl);
      response.end();
      return;
    }

    const url = Url.parse(fullUrl);

    // Get the site name
    const siteName = getRequestSiteName(request);

    const incomingBody = await getBody(request);

    // Create our router request
    const routerRequest: RouterRequest & { clientIp: string } = {
      headers: request.headers || {},
      verb: (request.method as HttpVerb),
      fullUrl: fullUrl,
      url: url,
      body: incomingBody,
      cookies: request.headers.cookie && Cookie.parse(request.headers.cookie as string) || {},
      params: url.query,
      clientIp
    };

    // Call the router with our request
    const routerResponse = await routers[siteName].go(routerRequest);

    // Loop through all set headers in the router response and add them to our HTTP response
    for (const [header, value] of Object.entries(routerResponse.headers)) {
      response.setHeader(header, value);
    }

    // Loop through all set cookies in the router response and add them to our HTTP response
		for (const [cookieName, cookie] of Object.entries(routerResponse.cookies)) {
			const options = (cookie.options || {}) as Cookie.CookieSerializeOptions;
			response.setHeader('Set-Cookie', Cookie.serialize(cookieName, cookie.value || '', options));
    }

    // Clear any cookies that have been "unset" by the router
    if (routerResponse.clearCookies) {
			for (const [cookieName, cookie] of Object.entries(routerResponse.clearCookies)) {
				response.setHeader('Set-Cookie', Cookie.serialize(cookieName, '', { expires: new Date(0) }));
      }
    }

    // Prepare our response body and content type
    let body: any = {};
    let bodyBuffer: Buffer | undefined;
    let contentType = 'application/json';

    // If we have been given a string by the router, set the response body and type to
    // that set in the router response, otherwise make sure we have valid JSON to return
    // and set the content type to 'application/json'
    if (typeof routerResponse.body === 'string') {
      contentType = routerResponse.contentType || 'text/html';
      body = routerResponse.body;
    } else if (Buffer.isBuffer(routerResponse.body)) {
      contentType = routerResponse.contentType || 'application/octet-stream';
      body = routerResponse.body;
    } else {
      contentType = routerResponse.contentType || 'application/json';
      body = JSON.stringify(routerResponse.body);
    }

    if (!routerResponse.doNotZip) {
      body = Pako.gzip(body);
      bodyBuffer = Buffer.from(body);

      // Set the encoding and length headers
      response.setHeader('Content-Encoding', 'gzip');
      response.setHeader('Content-Length', bodyBuffer.length);

      // Clean up unnecessary stuff from the content type
      if (contentType.indexOf('charset') > -1) {
        contentType = contentType.substr(0, contentType.indexOf(';'));
      }
      contentType += '; charset=x-user-defined-binary';
    } else {
      bodyBuffer = Buffer.from(body);
    }
    response.setHeader('Content-Type', contentType);
    response.statusCode = routerResponse.statusCode || 200;

    //HACK: Replace this with Task Module for modifying headers
    if (fullUrl.includes('widget') || fullUrl.includes('geo-lookup') || fullUrl.includes('proxy')) {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Request-Method', '*');
      response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
      response.setHeader('Access-Control-Allow-Headers', '*');
    }

    // Send our HTTP response with the GZipped buffer
    response.end(bodyBuffer);
  } catch(err) {
    console.error('Failed to handle router request', err);
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = 500;
    response.end(Stringify(err, null, 4));
  }
};

GetBody.textTypes.push('application/x-ndjson');
async function getBody(request: Http.IncomingMessage): Promise<any> {
  try {
    if (!request.headers.hasOwnProperty('content-type')) {
      request.headers['content-type'] = 'text/plain';
    }
    const body = await GetBody.parse(request, request.headers as GetBody.Headers);
    return body;
  } catch(err) {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const emailerRequestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  if (!routers) {
    reloadRouters();
  }

  if (!routers || !routers.hasOwnProperty('emailer')) {
    response.statusCode = 500;
    response.end('No routers loaded or emailer router missing');
    return;
  }

  const responses: any[] = [];

  for (let i = 0; i < 6; i++) {
    const response = await processEmails();
    responses.push(response);
    await sleep(5000);
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'pplication/json');

  response.end(Stringify(responses, null, 4));
}

async function processEmails(): Promise<{ [key: string]: RouterResponse }|null> {
  if (routers && routers.hasOwnProperty('emailer')) {
    const request: RouterRequest = {
      url: Url.parse('https://emailer.scvo.net/process'),
      fullUrl: 'https://emailer.scvo.net/process',
      params: {},
      headers: {},
      cookies: {},
      verb: 'GET',
      body: null
    };
    const vsRequest: RouterRequest = {
      url: Url.parse('https://emailer.scvo.net/vs-process'),
      fullUrl: 'https://emailer.scvo.net/vs-process',
      params: {},
      headers: {},
      cookies: {},
      verb: 'GET',
      body: null
    };
    try {
      const response = await routers.emailer.go(request);
      const vsResponse = await routers.emailer.go(vsRequest);
      return { main: response, vs: vsResponse };
    } catch(err) {
      console.error('Error mocking emailer.go with request:', request, err);
    }
  }
  return null;
}

/*
 * Work out the configuration name of the incoming site. if that fails return the default
 */
function getRequestSiteName(request: Http.IncomingMessage) {
  const host = request && request.headers && request.headers.host || 'localhost';
  const hostname = host.split(':')[0];
  try {
    if (!routers) {
      throw new Error('No routers loaded');
    }
    if (!domainMap.hasOwnProperty(hostname)) {
      throw new Error('Hostname not in map: ' + hostname);
    }
    const siteName = domainMap[hostname];
    if (!routers.hasOwnProperty(siteName)) {
      throw new Error('No router called: ' + siteName);
    }
    return siteName;
  } catch(err) {
    //throw new Error('Failed to get site name for host: ' + hostname, err);
    return CONFIG.defaultSiteName;
  }
}


/*
 * Create and setup our HTTP server instance
 */
if (LIVE) {
  const server = Http.createServer(requestHandler);
  server.listen(HTTP_PORT, (err: Error) => {
    if (err) {
      console.error('Could not start our server on port:', HTTP_PORT, err);
    } else {
      console.log('Listening on port:', HTTP_PORT);
    }
  });
} else {
  const options: Https.ServerOptions = {
    key: Fs.readFileSync(Path.join(__dirname, '../test-cert/_wildcard.local-key.pem')),
    cert: Fs.readFileSync(Path.join(__dirname, '../test-cert/_wildcard.local.pem'))
  };
  const server = Https.createServer(options, requestHandler);
  server.listen(HTTP_PORT, (err: Error) => {
    if (err) {
      console.error('Could not start our secure server on port:', HTTP_PORT, err);
    } else {
      console.log('Listening securely on port:', HTTP_PORT);
    }
  });
}
