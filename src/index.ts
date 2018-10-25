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
import { exec as Exec } from 'child_process'

// Internal Imports
import { CONFIG } from './config';
import { Map } from './interfaces';
import { Helpers } from './helpers';
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
const IsGzip = require('is-gzip');

require('source-map-support').install();

// Router Imports
import {
  Router, RouterConfiguration, RouterRequest, RouterResponse, 
  HttpVerb, RendererHandlebars, RendererJsone, TaskElasticsearch, 
  TaskMySQL, TaskRedirect, TaskRenderLayout, TaskRequest, 
  TaskRender, TaskFirebaseAuth, TaskFirebaseRtbGet, 
  TaskFirebaseRtbSet, TaskTransform, TaskMailgun, TaskGeneratePdf
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
const FIREBASE_SITES_PATH: string = '/contexts/';
const SITES_GLOB: string = Path.join(CONFIG.localSitesDir, '**/*-site.json')
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

// Setup Routers
let routers: Map<Router> | null = null;
let domainMap: Map<string> = {};

/**
 * END: Global variables
 * @region
 */

/*
 * Setup auto reload of site configurations
 */
if (LIVE) {
  const ref = firebase.database().ref(FIREBASE_SITES_PATH);
  ref.on('value', async (snapshot: Firebase.database.DataSnapshot | null) => {
    console.log('FIREBASE WATCHER -> Sites configurations changed, reloading routers');
    await reloadRouters();
  });
} else {
  const watcher = Chokidar.watch(SITES_GLOB);
  console.log('FILEWATCHER -> Monitoring the following glob for changes:', SITES_GLOB);
  watcher.on('change', async (path: string) => {
    console.log('FILEWATCHER -> Site configurations changed, reloading routers');
		try {
    	await reloadRouters();    
		} catch(err) {
			console.error('Failed to reload routers:', err);
		}
  });
}

function clearRouters() {
  if (routers) {
    console.log('Clearing Routers:', Object.keys(routers));
    for (var name in routers) {
      delete routers[name];
    }
    console.log('Cleared Routers:', Object.keys(routers));
  }

  routers = {};
  domainMap = {};
}

async function reloadRouters() {
  try {
    clearRouters();
    routers = {};

    let sites: Map<RouterConfiguration> = {};
    const taskModules = createTaskModules();

    if (LIVE) {
      const ref = firebase.database().ref(FIREBASE_SITES_PATH);
      const sitesSnapshot = await ref.once('value');
      if (!sitesSnapshot.exists()) {
        console.error('Sites configurations do not exist in Firebase at:', FIREBASE_SITES_PATH);
        return;
      }
      sites = sitesSnapshot.val() as Map<RouterConfiguration>;
    } else {
      console.log('Loading routers locally using this glob:', SITES_GLOB);
      const sitesPaths = await Globby(SITES_GLOB);
      for (const sitePath of sitesPaths) {
        const siteName = Path.basename(sitePath).split('-site.json')[0];
        console.log('Loading site:', siteName, 'from', sitePath);
        const siteJson = Fs.readFileSync(sitePath).toString();
        sites[siteName] = JSON.parse(siteJson);
      }
    }

    for (const [name, config] of Object.entries(sites)) {
      const renderers = {
        handlebars: createHandlebarsRenderer(config.metaData.handlebars.partials),
        jsone: new RendererJsone()
      };
      for (const domain of config.domains) {
        domainMap[domain] = name;
      }
      config.metaData.live = LIVE;
      config.metaData.dev = !LIVE;
      routers[name] = new Router(config, taskModules, renderers);
    } 

    console.log('Routers reloaded:', domainMap);
  } catch(err) {
    throw new Error('Failed to reload routers', err);
  }
}

function createHandlebarsRenderer(partials: Map<string>): RendererHandlebars {
  const hbsEnv = Handlebars.create();
  const hbs = HbsFactory(hbsEnv);
  Helpers.register(hbs);
  for (const [name, partial] of Object.entries(partials)) {
    hbs.registerPartial(name, partial);
  }
  return new RendererHandlebars(hbs);
}

function createTaskModules(): Map<any> {
  const routerTaskModules = {
    elasticsearch: new TaskElasticsearch(),
    redirect: new TaskRedirect(),
    mysql: new TaskMySQL(CONFIG.mysqlAccounts),
    render: new TaskRender(),
    renderLayout: new TaskRenderLayout(),
    firebaseAuth: new TaskFirebaseAuth(firebaseApps),
    firebaseRtbGet: new TaskFirebaseRtbGet(firebaseApps),
    firebaseRtbSet: new TaskFirebaseRtbSet(firebaseApps),
    generatePdf: new TaskGeneratePdf({
      Roboto: {
        normal: Path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
        bold: Path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
        italics: Path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
        bolditalics: Path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
      }
    }),
    transform: new TaskTransform({ querystring: Querystring, url: Url }),
    mailgun: new TaskMailgun(CONFIG.mailgunAccounts),
    request: new TaskRequest()
  };
  return routerTaskModules;
}

/*
 * Create are base handler for all incoming requests
 */
const requestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  if (request.url && request.url.startsWith('/assets/')) {
    await assetsRequestHandler(request, response);
  } else {
    await routerRequestHandler(request, response);
  }
}

const assetsRequestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  try {
    const siteName = getRequestSiteName(request);
    const url = (request.url as string).split('/assets/')[1];
    const path = Path.join(CONFIG.localSitesDir, siteName, url || '');
    console.log('Getting asset:', path); 
    const stat = Fs.statSync(path);
    const contentType = Mime.getType(path) || 'text/plain';
    const gzipped = IsGzip(Fs.readFileSync(path));

    const head: any = {
      'Content-Type': contentType,
      'Content-Length': stat.size
    };

    if (gzipped) {
      console.log('Gzipped:', path);
      head['Content-Encoding'] = 'gzip';
    }

    response.writeHead(200, head);

    Fs.createReadStream(path).pipe(response);
  } catch(err) {
    if (request.url && !request.url.endsWith('.map')) {
      console.error('Failed to get asset', err, request.url);
    }
    response.statusCode = 404;
    response.end(Stringify(err, null, 4));
  }
}

const routerRequestHandler = async (request: Http.IncomingMessage, response: Http.ServerResponse) => {
  try {
    if (!routers) {
      await reloadRouters();
    }

    if (!routers) {
      response.end('Routers could not be loaded');
      response.statusCode = 500;
      return;
    }

    const host = request.headers.host as string || 'localhost';
    const hostname = host.split(':')[0];
    const fullUrl = 'https://' + host + request.url;
    const url = Url.parse(fullUrl);
   
    console.log('Request for:', fullUrl);

    const siteName = getRequestSiteName(request);

    const routerRequest: RouterRequest = {
      headers: request.headers || {},
      verb: (request.method as HttpVerb),
      fullUrl: fullUrl,
      url: url,
      body: null,
      cookies: request.headers.cookie && Cookie.parse(request.headers.cookie as string) || {},
      params: url.query
    };

    const routerResponse = await routers[siteName].go(routerRequest);

    for (const [header, value] of Object.entries(routerResponse.headers)) {
      response.setHeader(header, value);
    }
    
		for (const [cookieName, cookie] of Object.entries(routerResponse.cookies)) {
			const options = (cookie.options || {}) as Cookie.CookieSerializeOptions;
			response.setHeader('Set-Cookie', Cookie.serialize(cookieName, cookie.value || '', options));
    }

    if (routerResponse.clearCookies) {
			for (const [cookieName, cookie] of Object.entries(routerResponse.clearCookies)) {
				response.setHeader('Set-Cookie', Cookie.serialize(cookieName, '', { expires: new Date(0) }));
      }
    }

    response.setHeader('content-type', routerResponse.contentType);
    response.statusCode = routerResponse.statusCode;
    response.end(routerResponse.body);
  } catch(err) {
    console.error('Failed to handle router request', err);
    response.setHeader('content-type', 'application/json');
    response.statusCode = 500;
    response.end(Stringify(err, null, 4));
  }
};

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
    throw new Error('Failed to get site name for host: ' + hostname, err);
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