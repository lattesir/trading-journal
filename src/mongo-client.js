import { MongoClient } from 'mongodb';


export async function createMongoClient(connectionString, options = {}) {
    const url = new URL(connectionString);

    const hasProxy = url.searchParams.has('proxyHost') || options.proxyHost;

    if (hasProxy) {
        try {
            await import('socks');
        } catch (e) {
            throw new Error(
                'You have configured a proxy, but the optional module `socks` is not installed. \n' +
                'Please run `npm install socks` to enable SOCKS5 proxy support.'
            );
        }
    }

    return new MongoClient(connectionString, options);
}
