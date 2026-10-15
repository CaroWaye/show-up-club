// Requests go to backend.js, which runs on this device, instead of to a server.
import { request } from './backend.js';

export const get = (url) => request('GET', url);
export const post = (url, body) => request('POST', url, body);
export const put = (url, body) => request('PUT', url, body);
export const del = (url) => request('DELETE', url);
