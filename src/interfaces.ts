import * as Firebase from 'firebase-admin';

export interface Config {
  defaultFirebaseAccount: string;
  defaultSiteName: string;
  defaultHttpPort: number;
  localSitesDir: string;
  firebasePath: string;
  serviceAccounts: Map<ServiceAccount>;
  salesforceAccounts: Map<any>;
  firebaseAccounts: Map<FirebaseAccount>;
  mysqlAccounts: Map<MySqlAccount>;
  mailgunAccounts: Map<any>;
  googleAccounts: Map<GoogleAccount>;
}

export interface Map<T> {
  [name: string]: T;
}

export interface ServiceAccount {
  type: string; 
  project_id: string;
  private_key_id: string;
  private_key: string; 
  client_email: string; 
  client_id: string; 
  auth_uri: string; 
  token_uri: string; 
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string; 
}

export interface FirebaseAccount {
  credential: ServiceAccount;
  databaseURL: string;
}

export interface MySqlAccount { 
  host: string;
  user: string;
  password: string;
  database: string;
}

export interface GoogleAccount {
  clientEmail: string;
  privateKey: string;
}